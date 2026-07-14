import type { Prisma } from "../generated/prisma/client";

export const ORDER_RESERVATION_MINUTES = 30;

type InventoryLine = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

export class InventoryReservationError extends Error {
  constructor() {
    super("O estoque mudou enquanto o pedido era finalizado. Revise o carrinho e tente novamente.");
    this.name = "InventoryReservationError";
  }
}

export function getOrderExpiration(now = new Date()) {
  return new Date(now.getTime() + ORDER_RESERVATION_MINUTES * 60 * 1000);
}

export async function reserveInventory(
  transaction: Prisma.TransactionClient,
  storeId: string,
  items: InventoryLine[],
) {
  for (const item of items) {
    const result = item.variantId
      ? await transaction.productVariant.updateMany({
          where: {
            id: item.variantId,
            productId: item.productId,
            isActive: true,
            stockQuantity: { gte: item.quantity },
            product: { storeId, isActive: true, hasVariants: true },
          },
          data: { stockQuantity: { decrement: item.quantity } },
        })
      : await transaction.product.updateMany({
          where: {
            id: item.productId,
            storeId,
            isActive: true,
            hasVariants: false,
            stockQuantity: { gte: item.quantity },
          },
          data: { stockQuantity: { decrement: item.quantity } },
        });

    if (result.count !== 1) throw new InventoryReservationError();
  }
}

export async function releaseInventory(
  transaction: Prisma.TransactionClient,
  items: InventoryLine[],
) {
  for (const item of items) {
    if (item.variantId) {
      await transaction.productVariant.update({
        where: { id: item.variantId },
        data: { stockQuantity: { increment: item.quantity } },
      });
    } else {
      await transaction.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { increment: item.quantity } },
      });
    }
  }
}
