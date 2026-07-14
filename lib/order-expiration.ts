import { getDatabase } from "./database";
import { releaseInventory } from "./inventory";

export async function expirePendingOrders(now = new Date(), batchSize = 50) {
  const database = getDatabase();
  const candidates = await database.order.findMany({
    where: {
      inventoryStatus: "RESERVED",
      paymentStatus: "WAITING_PAYMENT",
      expiresAt: { lte: now },
    },
    orderBy: { expiresAt: "asc" },
    take: batchSize,
    select: { id: true },
  });

  let expired = 0;
  for (const candidate of candidates) {
    const released = await database.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: { id: candidate.id },
        select: {
          id: true,
          storeId: true,
          customerEmail: true,
          items: { select: { productId: true, variantId: true, quantity: true } },
        },
      });
      if (!order) return false;

      const claimed = await transaction.order.updateMany({
        where: {
          id: order.id,
          inventoryStatus: "RESERVED",
          paymentStatus: "WAITING_PAYMENT",
          expiresAt: { lte: now },
        },
        data: {
          inventoryStatus: "RELEASED",
          stockReleasedAt: now,
          status: "CANCELLED",
          paymentStatus: "CANCELLED",
          cancelledAt: now,
        },
      });
      if (claimed.count !== 1) return false;

      await releaseInventory(transaction, order.items);
      if (order.customerEmail) {
        await transaction.emailOutbox.upsert({
          where: { eventKey: `order:${order.id}:cancelled` },
          update: {},
          create: {
            storeId: order.storeId,
            orderId: order.id,
            eventKey: `order:${order.id}:cancelled`,
            type: "ORDER_CANCELLED",
          },
        });
      }
      return true;
    });
    if (released) expired += 1;
  }

  await database.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: now } } });
  return { scanned: candidates.length, expired, hasMore: candidates.length === batchSize };
}
