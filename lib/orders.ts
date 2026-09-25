import { getDatabase } from "./database";
import { CartQuoteError, quoteCart } from "./cart-quote";
import {
  getOrderExpiration,
  InventoryReservationError,
  reserveInventory,
} from "./inventory";
import type { CheckoutRequest } from "../storefront/checkout/contracts";
import { z } from "zod";
import { assertNewPurchasesAllowed } from "./store-lifecycle";

export type OrderCustomerIdentity = { authUserId: string; email: string };

export function resolveCheckoutEmail(submittedEmail: string | null | undefined, identity?: OrderCustomerIdentity | null) {
  return identity?.email.trim().toLowerCase() ?? (submittedEmail?.trim().toLowerCase() || null);
}

export async function createPendingOrder(payload: CheckoutRequest, identity?: OrderCustomerIdentity | null) {
  if (identity) identity = z.object({ authUserId: z.string().min(1).max(80), email: z.email() }).parse({ authUserId: identity.authUserId, email: identity.email });
  const quote = await quoteCart(payload.storeSlug, payload.items, payload.deliveryMethod);
  if (quote.issues.length) {
    throw new CartQuoteError(quote.issues[0], "INVALID_ITEM");
  }

  const database = getDatabase();
  return database.$transaction(async (transaction) => {
    await assertNewPurchasesAllowed(transaction, quote.storeId);
    const now = new Date();
    await reserveInventory(transaction, quote.storeId, quote.items);

    const effectiveEmail = resolveCheckoutEmail(payload.customer.email, identity);
    const contact = { name: payload.customer.name, phone: payload.customer.phone, email: effectiveEmail };
    // Only a server-verified authentication ID can reuse an account identity.
    // Guest contacts are independent, even when their phone/email matches.
    const customer = identity
      ? await transaction.customer.upsert({
          where: { storeId_authUserId: { storeId: quote.storeId, authUserId: identity.authUserId } },
          update: contact,
          create: { ...contact, storeId: quote.storeId, authUserId: identity.authUserId, isQuarantined: false },
        })
      : await transaction.customer.create({
          data: { ...contact, storeId: quote.storeId, isQuarantined: false },
        });

    const order = await transaction.order.create({
      data: {
        storeId: quote.storeId,
        customerId: customer.id,
        subtotalCents: quote.subtotalCents,
        shippingCents: quote.shippingCents,
        totalCents: quote.totalCents,
        deliveryMethod: payload.deliveryMethod,
        customerName: payload.customer.name,
        customerPhone: payload.customer.phone,
        customerEmail: effectiveEmail,
        shippingZipCode: payload.deliveryMethod === "LOCAL_DELIVERY" ? payload.address?.zipCode : null,
        shippingStreet: payload.deliveryMethod === "LOCAL_DELIVERY" ? payload.address?.street : null,
        shippingNumber: payload.deliveryMethod === "LOCAL_DELIVERY" ? payload.address?.number : null,
        shippingComplement: payload.deliveryMethod === "LOCAL_DELIVERY" ? payload.address?.complement || null : null,
        shippingNeighborhood: payload.deliveryMethod === "LOCAL_DELIVERY" ? payload.address?.neighborhood : null,
        shippingCity: payload.deliveryMethod === "LOCAL_DELIVERY" ? payload.address?.city : null,
        shippingState: payload.deliveryMethod === "LOCAL_DELIVERY" ? payload.address?.state?.toUpperCase() : null,
        notes: payload.notes || null,
        inventoryStatus: "RESERVED",
        reservedAt: now,
        expiresAt: getOrderExpiration(now),
        items: {
          create: quote.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            variantName: item.variantName,
            sku: item.sku,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            totalCents: item.totalCents,
          })),
        },
      },
      select: { id: true, storeId: true, status: true, totalCents: true, createdAt: true, expiresAt: true },
    });

    if (effectiveEmail) {
      await transaction.emailOutbox.create({
        data: {
          storeId: order.storeId,
          orderId: order.id,
          eventKey: `order:${order.id}:created`,
          type: "ORDER_CREATED",
        },
      });
    }

    return order;
  });
}

export function isInventoryReservationError(error: unknown) {
  return error instanceof InventoryReservationError;
}
