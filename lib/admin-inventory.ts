import { z } from "zod";
import { can } from "./admin-auth";
import { getDatabase } from "./database";

const adjustmentSchema = z.object({
  productId: z.string().min(1).max(80),
  variantId: z.string().min(1).max(80).nullable(),
  requestId: z.string().uuid(),
  expectedQuantity: z.number().int().min(0).max(2_147_483_647),
  delta: z.number().int().min(-2_147_483_647).max(2_147_483_647).refine((value) => value !== 0),
  reason: z.string().trim().min(3).max(500),
}).strict();

export class StockAdjustmentError extends Error {
  constructor(public code: "STOCK_CONFLICT" | "INVALID_STOCK" | "IDEMPOTENCY_CONFLICT") {
    super(code);
  }
}

export async function adjustAvailableStock(
  actor: { userId: string; storeId: string },
  input: z.infer<typeof adjustmentSchema>,
) {
  const data = adjustmentSchema.parse(input);
  return getDatabase().$transaction(async (transaction) => {
    const operator = await transaction.user.findFirst({
      where: { id: actor.userId, storeId: actor.storeId, isActive: true, store: { isActive: true } },
    });
    if (!operator || !can(operator.role, "inventory:write")) throw new Error("FORBIDDEN");
    // Serialize retries of this operation before checking its durable result.
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${actor.storeId}:${data.requestId}`}, 0))`;
    const existing = await transaction.stockAdjustment.findUnique({
      where: { storeId_requestId: { storeId: actor.storeId, requestId: data.requestId } },
    });
    if (existing) {
      if (existing.actorId !== actor.userId || existing.productId !== data.productId
        || existing.variantId !== data.variantId || existing.delta !== data.delta
        || existing.reason !== data.reason || existing.quantityBefore !== data.expectedQuantity) {
        throw new StockAdjustmentError("IDEMPOTENCY_CONFLICT");
      }
      return existing;
    }

    const next = data.expectedQuantity + data.delta;
    if (!Number.isSafeInteger(next) || next < 0 || next > 2_147_483_647) {
      throw new StockAdjustmentError("INVALID_STOCK");
    }
    const updated = data.variantId
      ? await transaction.productVariant.updateMany({
          where: {
            id: data.variantId, productId: data.productId, stockQuantity: data.expectedQuantity,
            product: { storeId: actor.storeId, hasVariants: true },
          },
          data: { stockQuantity: { increment: data.delta } },
        })
      : await transaction.product.updateMany({
          where: { id: data.productId, storeId: actor.storeId, hasVariants: false, stockQuantity: data.expectedQuantity },
          data: { stockQuantity: { increment: data.delta } },
        });
    if (updated.count !== 1) throw new StockAdjustmentError("STOCK_CONFLICT");
    return transaction.stockAdjustment.create({
      data: {
        storeId: actor.storeId, actorId: actor.userId, productId: data.productId,
        variantId: data.variantId, requestId: data.requestId, quantityBefore: data.expectedQuantity,
        delta: data.delta, quantityAfter: next, reason: data.reason,
      },
    });
  });
}
