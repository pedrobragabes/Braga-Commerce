import type { Prisma } from "../generated/prisma/client";

// Every reservation/payment writer locks the order before reading its state.
// Conditional inventory updates alone do not serialize different payment events.
export async function lockOrder(transaction: Prisma.TransactionClient, orderId: string) {
  await transaction.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
}
