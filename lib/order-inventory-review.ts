import { z } from "zod";
import { getDatabase } from "./database";
import { InventoryReservationError, reserveInventory } from "./inventory";

const resolutionSchema = z.object({
  orderId: z.string().min(1).max(80), requestId: z.uuid(),
  expectedVersion: z.number().int().min(0).max(2_147_483_647),
  action: z.enum(["COMMIT_STOCK", "CANCEL_FULFILLMENT"]),
  reason: z.string().trim().min(5).max(500),
}).strict();

export class InventoryReviewError extends Error {
  constructor(public code: "FORBIDDEN" | "ORDER_NOT_FOUND" | "ORDER_CHANGED" | "REVIEW_NOT_OPEN" | "INSUFFICIENT_STOCK" | "IDEMPOTENCY_CONFLICT") { super(code); }
}

export async function resolveOrderInventory(actor: { userId: string; storeId: string }, input: unknown) {
  const data = resolutionSchema.parse(input);
  return getDatabase().$transaction(async (transaction) => {
    // Recheck membership under a shared lock; a stale session cannot grant this action.
    await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.userId} FOR SHARE`;
    const operator = await transaction.user.findFirst({ where: { id: actor.userId, storeId: actor.storeId, isActive: true } });
    if (!operator || !["OWNER", "ADMIN"].includes(operator.role)) throw new InventoryReviewError("FORBIDDEN");
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inventory-review:${actor.storeId}:${data.requestId}`}, 0))`;
    const existing = await transaction.orderInventoryResolution.findUnique({ where: { storeId_requestId: { storeId: actor.storeId, requestId: data.requestId } } });
    if (existing) {
      if (existing.orderId !== data.orderId || existing.actorId !== actor.userId || existing.action !== data.action
        || existing.reason !== data.reason || existing.previousVersion !== data.expectedVersion) throw new InventoryReviewError("IDEMPOTENCY_CONFLICT");
      return existing;
    }
    await transaction.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${data.orderId} AND "storeId" = ${actor.storeId} FOR UPDATE`;
    const order = await transaction.order.findFirst({ where: { id: data.orderId, storeId: actor.storeId }, include: { items: true } });
    if (!order) throw new InventoryReviewError("ORDER_NOT_FOUND");
    if (order.operationVersion !== data.expectedVersion) throw new InventoryReviewError("ORDER_CHANGED");
    if (order.paymentStatus !== "PAID" || order.inventoryStatus !== "REQUIRES_REVIEW"
      || (order.fulfillmentStatus !== "NOT_FULFILLED" && !(data.action === "CANCEL_FULFILLMENT" && order.fulfillmentStatus === "CANCELLED"))) throw new InventoryReviewError("REVIEW_NOT_OPEN");
    if (data.action === "COMMIT_STOCK") {
      if (!order.items.length) throw new InventoryReviewError("INSUFFICIENT_STOCK");
      try { await reserveInventory(transaction, actor.storeId, order.items); }
      catch (error) {
        if (error instanceof InventoryReservationError) throw new InventoryReviewError("INSUFFICIENT_STOCK");
        throw error;
      }
    }
    await transaction.order.update({ where: { id: order.id }, data: {
      operationVersion: { increment: 1 },
      ...(data.action === "COMMIT_STOCK" ? { inventoryStatus: "COMMITTED", stockCommittedAt: new Date() }
        : { fulfillmentStatus: "CANCELLED", inventoryStatus: "RELEASED" }),
    } });
    return transaction.orderInventoryResolution.create({ data: {
      storeId: actor.storeId, orderId: order.id, actorId: actor.userId, requestId: data.requestId,
      action: data.action, reason: data.reason, previousVersion: order.operationVersion,
    } });
  });
}
