import { Payment, WebhookSignatureValidator } from "mercadopago";
import { getDatabase } from "../database";
import { releaseInventory } from "../inventory";
import { lockOrder } from "../order-lock";
import { getMercadoPagoClient, getMercadoPagoWebhookSecret } from "./config";
import { assertPaymentAccountBinding, isLegacyPaymentAccount, paymentAccountByKey } from "./accounts";
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
  accountKey?: string;
}) {
  WebhookSignatureValidator.validate({
    xSignature: input.signature,
    xRequestId: input.requestId,
    dataId: input.dataId,
    secret: getMercadoPagoWebhookSecret(input.accountKey),
    toleranceSeconds: 600,
    ...(input.now ? { now: input.now } : {}),
  });
}

export async function processMercadoPagoPayment(
  paymentId: string,
  requestId: string | null,
  eventType: string,
  accountKey?: string,
) {
  const account = paymentAccountByKey(accountKey);
  const database = getDatabase();
  await database.$transaction((transaction) => assertPaymentAccountBinding(transaction, account));
  const payment = await new Payment(getMercadoPagoClient(account)).get({ id: paymentId });
  const providerStatus = payment.status ?? "unknown";
  const eventKey = buildPaymentEventKey(paymentId, providerStatus, account.key);
  const integrityFailure = String(payment.id) !== paymentId ? "PAYMENT_ID_MISMATCH"
    : !Number.isSafeInteger(payment.collector_id) || String(payment.collector_id) !== account.collectorId ? "COLLECTOR_MISMATCH"
      : payment.live_mode !== (account.environment === "production") ? "ENVIRONMENT_MISMATCH" : null;

  const existingEvent = await database.paymentEvent.findUnique({ where: { eventKey } });
  if (!integrityFailure && existingEvent && !["RECEIVED", "PROCESSING"].includes(existingEvent.result)) {
    return { result: "DUPLICATE", orderId: existingEvent.orderId, providerStatus };
  }

  const metadataOrderId =
    payment.metadata && typeof payment.metadata === "object"
      ? (payment.metadata as Record<string, unknown>).order_id
      : undefined;
  const orderId =
    typeof payment.external_reference === "string"
      ? payment.external_reference
      : typeof metadataOrderId === "string"
        ? metadataOrderId
        : null;
  const transition = mapMercadoPagoStatus(providerStatus);
  const amountCents =
    typeof payment.transaction_amount === "number" && Number.isFinite(payment.transaction_amount)
      && Math.abs(payment.transaction_amount * 100 - Math.round(payment.transaction_amount * 100)) < 0.000001
      ? Math.round(payment.transaction_amount * 100)
      : null;

  return database.$transaction(async (transaction) => {
    // Native INSERT ... ON CONFLICT handles simultaneous first deliveries.
    // An upsert with an empty update can become a read/create pair in Prisma.
    await transaction.paymentEvent.createMany({
      skipDuplicates: true,
      data: {
        eventKey,
        provider: "mercadopago",
        providerEventId: paymentId,
        providerStatus,
        eventType,
        result: "RECEIVED",
        requestId,
      },
    });
    const event = await transaction.paymentEvent.findUniqueOrThrow({ where: { eventKey } });

    const claimed = await transaction.paymentEvent.updateMany({
      where: { id: event.id, result: "RECEIVED" },
      data: { result: "PROCESSING" },
    });
    if (claimed.count !== 1) {
      return { result: "DUPLICATE", orderId: event.orderId, providerStatus };
    }

    if (orderId) await lockOrder(transaction, orderId);
    const order = orderId
      ? await transaction.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            storeId: true,
            store: { select: { slug: true } },
            totalCents: true,
            paymentStatus: true,
            mercadoPagoPaymentId: true,
            inventoryStatus: true,
            fulfillmentStatus: true,
            paymentAccountKey: true,
            paymentLegacy: true,
            paidAt: true,
            cancelledAt: true,
            refundedAt: true,
            customerEmail: true,
            items: { select: { productId: true, variantId: true, quantity: true } },
          },
        })
      : null;

    const legacyEvent = order?.paymentLegacy && isLegacyPaymentAccount(account)
      ? await transaction.paymentEvent.findUnique({ where: { eventKey: buildPaymentEventKey(paymentId, providerStatus) } }) : null;
    let result = "APPLIED";
    if (integrityFailure) result = integrityFailure;
    else if (!order) result = "ORDER_NOT_FOUND";
    else if (order.storeId !== account.storeId) result = "STORE_MISMATCH";
    else if (order.paymentAccountKey && order.paymentAccountKey !== account.key) result = "ACCOUNT_MISMATCH";
    else if (!order.paymentAccountKey && !(order.paymentLegacy && isLegacyPaymentAccount(account))) result = "ACCOUNT_NOT_BOUND";
    else if (payment.currency_id !== "BRL") result = "CURRENCY_MISMATCH";
    else if (amountCents === null || amountCents !== order.totalCents) result = "AMOUNT_MISMATCH";
    else if (!order.paymentLegacy && (payment.metadata?.account_key !== account.key || payment.metadata?.store_id !== order.storeId || payment.metadata?.order_id !== order.id)) result = "METADATA_MISMATCH";
    else if (legacyEvent?.orderId === order.id && !["RECEIVED", "PROCESSING"].includes(legacyEvent.result)) {
      if (!order.paymentAccountKey) await transaction.order.update({ where: { id: order.id }, data: { paymentAccountKey: account.key } });
      result = "DUPLICATE";
    }
    else if (!transition) result = "IGNORED_STATUS";
    else if (
      !shouldApplyPaymentTransition(
        order.paymentStatus as InternalPaymentStatus,
        transition.paymentStatus,
        order.mercadoPagoPaymentId === paymentId,
      )
    )
      result = "IGNORED_STALE";
    else {
      const now = new Date();
      if (!order.paymentAccountKey) await transaction.order.update({ where: { id: order.id }, data: { paymentAccountKey: account.key } });
      if (transition.paymentStatus === "PAID") {
        const committed = await transaction.order.updateMany({
          where: { id: order.id, inventoryStatus: "RESERVED" },
          data: {
            operationVersion: { increment: 1 },
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
              operationVersion: { increment: 1 },
              status: transition.orderStatus,
              paymentStatus: transition.paymentStatus,
              mercadoPagoPaymentId: paymentId,
              inventoryStatus: "REQUIRES_REVIEW",
              paidAt: order.paidAt ?? now,
            },
          });
          result = "APPLIED_REQUIRES_INVENTORY_REVIEW";
        }
      } else if (
        (transition.paymentStatus === "CANCELLED" || transition.paymentStatus === "REFUNDED")
        && order.inventoryStatus === "RESERVED"
      ) {
        const released = await transaction.order.updateMany({
          where: { id: order.id, inventoryStatus: "RESERVED" },
          data: {
            operationVersion: { increment: 1 },
            status: transition.orderStatus,
            paymentStatus: transition.paymentStatus,
            mercadoPagoPaymentId: paymentId,
            inventoryStatus: "RELEASED",
            stockReleasedAt: now,
            ...(transition.paymentStatus === "CANCELLED"
              ? { cancelledAt: order.cancelledAt ?? now }
              : { refundedAt: order.refundedAt ?? now }),
          },
        });
        if (released.count === 1) {
          await releaseInventory(transaction, order.items);
        }
      } else {
        await transaction.order.update({
          where: { id: order.id },
          data: {
            operationVersion: { increment: 1 },
            status: transition.orderStatus,
            paymentStatus: transition.paymentStatus,
            mercadoPagoPaymentId: paymentId,
            ...(transition.paymentStatus === "REFUNDED" && order.inventoryStatus === "REQUIRES_REVIEW"
              ? { inventoryStatus: "RELEASED", ...(order.fulfillmentStatus === "NOT_FULFILLED" ? { fulfillmentStatus: "CANCELLED" } : {}) } : {}),
            ...(transition.paymentStatus === "CANCELLED"
              ? { cancelledAt: order.cancelledAt ?? now }
              : {}),
            ...(transition.paymentStatus === "REFUNDED"
              ? { refundedAt: order.refundedAt ?? now }
              : {}),
          },
        });
      }

      const emailType =
        transition.paymentStatus === "PAID"
          ? ("PAYMENT_CONFIRMED" as const)
          : transition.paymentStatus === "CANCELLED"
            ? ("ORDER_CANCELLED" as const)
            : transition.paymentStatus === "REFUNDED"
              ? ("PAYMENT_REFUNDED" as const)
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
        orderId: order?.storeId === account.storeId ? order.id : null,
        result,
        processedAt: new Date(),
      },
    });

    return { result, orderId: order?.storeId === account.storeId ? order.id : null, providerStatus };
  });
}
