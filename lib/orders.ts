import { getDatabase } from "./database";
import { CartQuoteError, quoteCart } from "./cart-quote";
import {
  getOrderExpiration,
  InventoryReservationError,
  reserveInventory,
} from "./inventory";
import type { CheckoutRequest } from "../storefront/checkout/contracts";

export type OrderCustomerIdentity = { authUserId: string; email: string };

type CheckoutCustomerLink = { id: string; authUserId: string | null };

export class CustomerIdentityError extends Error {}

export function resolveCheckoutEmail(
  submittedEmail: string | null | undefined,
  identity: OrderCustomerIdentity | null | undefined,
) {
  return identity?.email ?? (submittedEmail || null);
}

export function selectCheckoutCustomer(
  identity: OrderCustomerIdentity | null | undefined,
  linkedCustomer: CheckoutCustomerLink | null,
  phoneCustomer: CheckoutCustomerLink | null,
) {
  if (identity && phoneCustomer?.authUserId && phoneCustomer.authUserId !== identity.authUserId) {
    throw new CustomerIdentityError("Este telefone já está associado a outra conta.");
  }
  if (linkedCustomer && phoneCustomer && linkedCustomer.id !== phoneCustomer.id) {
    throw new CustomerIdentityError("Este telefone já está associado a outro cadastro.");
  }
  return linkedCustomer ?? phoneCustomer;
}

export async function createPendingOrder(payload: CheckoutRequest, identity?: OrderCustomerIdentity | null) {
  const quote = await quoteCart(payload.storeSlug, payload.items, payload.deliveryMethod);
  if (quote.issues.length) {
    throw new CartQuoteError(quote.issues[0], "INVALID_ITEM");
  }

  const database = getDatabase();
  return database.$transaction(async (transaction) => {
    const now = new Date();
    await reserveInventory(transaction, quote.storeId, quote.items);

    const effectiveEmail = resolveCheckoutEmail(payload.customer.email, identity);
    const linkedCustomer = identity ? await transaction.customer.findFirst({
      where: { storeId: quote.storeId, authUserId: identity.authUserId },
    }) : null;
    const phoneCustomer = await transaction.customer.findFirst({
      where: { storeId: quote.storeId, phone: payload.customer.phone }, orderBy: { updatedAt: "desc" },
    });
    const existingCustomer = selectCheckoutCustomer(identity, linkedCustomer, phoneCustomer);
    const customer = existingCustomer
      ? await transaction.customer.update({
          where: { id: existingCustomer.id },
          data: identity || !existingCustomer.authUserId ? {
            name: payload.customer.name, email: effectiveEmail, phone: payload.customer.phone,
            ...(identity ? { authUserId: identity.authUserId } : {}),
          } : {},
        })
      : await transaction.customer.create({
          data: {
            storeId: quote.storeId, name: payload.customer.name, phone: payload.customer.phone,
            email: effectiveEmail, ...(identity ? { authUserId: identity.authUserId } : {}),
          },
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

export function isCustomerIdentityError(error: unknown) {
  return error instanceof CustomerIdentityError;
}
