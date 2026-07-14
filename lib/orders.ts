import { getDatabase } from "./database";
import { CartQuoteError, quoteCart } from "./cart-quote";
import {
  getOrderExpiration,
  InventoryReservationError,
  reserveInventory,
} from "./inventory";
import type { CheckoutRequest } from "../storefront/checkout/contracts";

export async function createPendingOrder(payload: CheckoutRequest) {
  const quote = await quoteCart(payload.storeSlug, payload.items, payload.deliveryMethod);
  if (quote.issues.length) {
    throw new CartQuoteError(quote.issues[0], "INVALID_ITEM");
  }

  const database = getDatabase();
  return database.$transaction(async (transaction) => {
    const now = new Date();
    await reserveInventory(transaction, quote.storeId, quote.items);

    const existingCustomer = await transaction.customer.findFirst({
      where: { phone: payload.customer.phone },
      orderBy: { updatedAt: "desc" },
    });
    const customer = existingCustomer
      ? await transaction.customer.update({
          where: { id: existingCustomer.id },
          data: { name: payload.customer.name, email: payload.customer.email || null },
        })
      : await transaction.customer.create({
          data: { name: payload.customer.name, phone: payload.customer.phone, email: payload.customer.email || null },
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
        customerEmail: payload.customer.email || null,
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

    if (payload.customer.email) {
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
