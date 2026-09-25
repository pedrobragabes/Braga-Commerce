import { z } from "zod";
import { can } from "./admin-auth";
import { canOperateOrder } from "./admin-rules";
import { getDatabase } from "./database";

const operationSchema = z.object({
  orderId: z.string().min(1).max(80),
  fulfillmentStatus: z.enum(["NOT_FULFILLED", "PREPARING", "READY_FOR_PICKUP", "SHIPPED", "DELIVERED", "CANCELLED"]),
  internalNote: z.string().trim().max(500),
}).strict();

export async function saveOrderOperation(actor: { userId: string; storeId: string }, input: z.infer<typeof operationSchema>) {
  const data = operationSchema.parse(input);
  return getDatabase().$transaction(async (transaction) => {
    const operator = await transaction.user.findFirst({
      where: { id: actor.userId, storeId: actor.storeId, isActive: true, store: { isActive: true } },
    });
    if (!operator || !can(operator.role, "orders:write")) throw new Error("FORBIDDEN");
    await transaction.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${data.orderId} AND "storeId" = ${actor.storeId} FOR UPDATE`;
    const order = await transaction.order.findFirst({ where: { id: data.orderId, storeId: actor.storeId } });
    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (!canOperateOrder(order, data.fulfillmentStatus)) throw new Error("ORDER_NOT_READY");
    return transaction.order.update({
      where: { id: order.id },
      data: { fulfillmentStatus: data.fulfillmentStatus, internalNote: data.internalNote || null, operationVersion: { increment: 1 } },
    });
  });
}
