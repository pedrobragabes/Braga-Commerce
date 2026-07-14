import { Payment, WebhookSignatureValidator } from "mercadopago";
import { getDatabase } from "../database";
import { releaseInventory } from "../inventory";
import { getMercadoPagoClient, getMercadoPagoWebhookSecret } from "./config";
import {
  buildPaymentEventKey,
  mapMercadoPagoStatus,
  shouldApplyPaymentTransition,
  type InternalPaymentStatus,
} from "./status";

export function validateMercadoPagoWebhookSignature(input: {
  signature: string | null;
  requestId: string | null;
  dataId: string;
  now?: () => number;
}) {
  WebhookSignatureValidator.validate({
    xSignature: input.signature,
    xRequestId: input.requestId,
    dataId: input.dataId,
    secret: getMercadoPagoWebhookSecret(),
    toleranceSeconds: 600,
    ...(input.now ? { now: input.now } : {}),
  });
}

export async function processMercadoPagoPayment(
  paymentId: string,
  requestId: string | null,
  eventType: string,
) {
  const payment = await new Payment(getMercadoPagoClient()).get({ id: paymentId });
  const providerStatus = payment.status ?? "unknown";
  const eventKey = buildPaymentEventKey(paymentId, providerStatus);
  const database = getDatabase();

  const existingEvent = await database.paymentEvent.findUnique({ where: { eventKey } });
  if (existingEvent && existingEvent.result !== "RECEIVED") {
    return { result: "DUPLICATE", orderId: existingEvent.orderId, providerStatus };
  }

  const metadataOrderId = payment.metadata && typeof payment.metadata === "object"
    ? (payment.metadata as Record<string, unknown>).order_id
    : undefined;
  const orderId = typeof payment.external_reference === "string"
    ? payment.external_reference
    : typeof metadataOrderId === "string" ? metadataOrderId : null;
  const transition = mapMercadoPagoStatus(providerStatus);
  const amountCents = typeof payment.transaction_amount === "number"
    ? Math.round(payment.transaction_amount * 100)
    : null;

  return database.$transaction(async (transaction) => {
    const event = await transaction.paymentEvent.upsert({
      where: { eventKey },
      update: {},
      create: {
        eventKey,
        provider: "mercadopago",
        providerEventId: paymentId,
        providerStatus,
        eventType,
        result: "RECEIVED",
        requestId,
      },
    });

    if (event.result !== "RECEIVED") {
      return { result: "DUPLICATE", orderId: event.orderId, providerStatus };
    }

    const order = orderId ? await transaction.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        storeId: true,
        totalCents: true,
        paymentStatus: true,
        mercadoPagoPaymentId: true,
        inventoryStatus: true,
        paidAt: true,
        cancelledAt: true,
        refundedAt: true,
        customerEmail: true,
        items: { select: { productId: true, variantId: true, quantity: true } },
      },
    }) : null;

    let result = "APPLIED";
    if (!order) result = "ORDER_NOT_FOUND";
    else if (amountCents === null || amountCents !== order.totalCents) result = "AMOUNT_MISMATCH";
    else if (!transition) result = "IGNORED_STATUS";
    else if (!shouldApplyPaymentTransition(
      order.paymentStatus as InternalPaymentStatus,
      transition.paymentStatus,
      order.mercadoPagoPaymentId === paymentId,
    )) result = "IGNORED_STALE";
    else {
      const now = new Date();
      if (transition.paymentStatus === "PAID") {
        const committed = await transaction.order.updateMany({
          where: { id: order.id, inventoryStatus: "RESERVED" },
          data: {
            status: transition.orderStatus,
            paymentStatus: transition.paymentStatus,
            mercadoPagoPaymentId: paymentId,
            inventoryStatus: "COMMITTED",
            stockCommittedAt: now,
            paidAt: order.paidAt ?? now,
          },
        });
        if (committed.count !== 1) {
          await transaction.order.update({
            where: { id: order.id },
            data: {
              status: transition.orderStatus,
              paymentStatus: transition.paymentStatus,
              mercadoPagoPaymentId: paymentId,
              inventoryStatus: "REQUIRES_REVIEW",
              paidAt: order.paidAt ?? now,
            },
          });
          result = "APPLIED_REQUIRES_INVENTORY_REVIEW";
        }
      } else if (transition.paymentStatus === "CANCELLED" && order.inventoryStatus === "RESERVED") {
        const released = await transaction.order.updateMany({
          where: { id: order.id, inventoryStatus: "RESERVED" },
          data: {
            status: transition.orderStatus,
            paymentStatus: transition.paymentStatus,
            mercadoPagoPaymentId: paymentId,
            inventoryStatus: "RELEASED",
            stockReleasedAt: now,
            cancelledAt: order.cancelledAt ?? now,
          },
        });
        if (released.count === 1) {
          await releaseInventory(transaction, order.items);
        }
      } else {
        await transaction.order.update({
          where: { id: order.id },
          data: {
            status: transition.orderStatus,
            paymentStatus: transition.paymentStatus,
            mercadoPagoPaymentId: paymentId,
            ...(transition.paymentStatus === "CANCELLED" ? { cancelledAt: order.cancelledAt ?? now } : {}),
            ...(transition.paymentStatus === "REFUNDED" ? { refundedAt: order.refundedAt ?? now } : {}),
          },
        });
      }

      const emailType = transition.paymentStatus === "PAID"
        ? "PAYMENT_CONFIRMED" as const
        : transition.paymentStatus === "CANCELLED"
          ? "ORDER_CANCELLED" as const
          : transition.paymentStatus === "REFUNDED"
            ? "PAYMENT_REFUNDED" as const
            : null;
      if (emailType && order.customerEmail) {
        await transaction.emailOutbox.upsert({
          where: { eventKey: `order:${order.id}:${emailType.toLowerCase()}` },
          update: {},
          create: {
            storeId: order.storeId,
            orderId: order.id,
            eventKey: `order:${order.id}:${emailType.toLowerCase()}`,
            type: emailType,
          },
        });
      }
    }

    await transaction.paymentEvent.update({
      where: { id: event.id },
      data: {
        orderId: order?.id ?? null,
        result,
        processedAt: new Date(),
      },
    });

    return { result, orderId: order?.id ?? null, providerStatus };
  });
}
