import { randomUUID } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client";
import { getDatabase } from "../database";
import { can } from "../admin-auth";
import { createStorageAdminClient } from "./admin";

export const STORAGE_DELETION_LEASE_MS = 60_000;
export const UPLOAD_CLEANUP_DELAY_MS = 15 * 60_000;
const MAX_ATTEMPTS = 10;
export type MediaActor = { userId: string; storeId: string };

export async function requireMediaOperator(transaction: Prisma.TransactionClient, actor: MediaActor) {
  await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.userId} FOR SHARE`;
  const operator = await transaction.user.findFirst({ where: { id: actor.userId, storeId: actor.storeId, isActive: true } });
  if (!operator || !can(operator.role, "images:write")) throw new Error("FORBIDDEN");
}

function validObject(job: { storeId: string; productId: string; storagePath: string; bucket: string }) {
  return /^[a-z0-9][a-z0-9-]{2,62}$/.test(job.bucket)
    && /^[A-Za-z0-9_-]+$/.test(job.storeId) && /^[A-Za-z0-9_-]+$/.test(job.productId)
    && job.storagePath.startsWith(`${job.storeId}/${job.productId}/`)
    && /^[A-Za-z0-9_-]+\.(?:png|jpg|jpeg|webp)$/.test(job.storagePath.slice(`${job.storeId}/${job.productId}/`.length));
}

// Persist BEFORE upload. If upload/finalization crashes, the worker still knows
// the unique object name; successful attachment cancels this job atomically.
export async function prepareImageUpload(actor: MediaActor, input: { productId: string; bucket: string; storagePath: string }, now = new Date()) {
  if (!validObject({ ...input, storeId: actor.storeId })) throw new Error("INVALID_STORAGE_PATH");
  return getDatabase().$transaction(async (transaction) => {
    await requireMediaOperator(transaction, actor);
    const product = await transaction.product.findFirst({ where: { id: input.productId, storeId: actor.storeId } });
    if (!product) throw new Error("PRODUCT_NOT_FOUND");
    return transaction.storageDeletionJob.create({ data: {
      ...input, storeId: actor.storeId, actorId: actor.userId, reason: "UPLOAD_COMPENSATION",
      nextAttemptAt: new Date(now.getTime() + UPLOAD_CLEANUP_DELAY_MS),
    } });
  });
}

export async function finishImageUpload(actor: MediaActor, input: { jobId: string; productId: string; url: string; alt: string | null }) {
  return getDatabase().$transaction(async (transaction) => {
    await requireMediaOperator(transaction, actor);
    await transaction.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${input.productId} AND "storeId" = ${actor.storeId} FOR UPDATE`;
    const product = await transaction.product.findFirst({ where: { id: input.productId, storeId: actor.storeId } });
    if (!product) throw new Error("PRODUCT_NOT_FOUND");
    await transaction.$queryRaw`SELECT "id" FROM "StorageDeletionJob" WHERE "id" = ${input.jobId} FOR UPDATE`;
    const job = await transaction.storageDeletionJob.findFirst({ where: {
      id: input.jobId, storeId: actor.storeId, productId: product.id, actorId: actor.userId, reason: "UPLOAD_COMPENSATION",
    } });
    if (!job || job.status !== "PENDING" || job.attempts !== 0) throw new Error("UPLOAD_CLEANUP_STARTED");
    const highest = await transaction.productImage.aggregate({ where: { productId: product.id }, _max: { sortOrder: true } });
    const image = await transaction.productImage.create({ data: {
      productId: product.id, url: input.url, alt: input.alt, storagePath: job.storagePath, storageBucket: job.bucket,
      sortOrder: (highest._max.sortOrder ?? -1) + 1,
    }, select: { id: true, url: true, alt: true, sortOrder: true } });
    await transaction.storageDeletionJob.update({ where: { id: job.id }, data: { status: "CANCELLED", completedAt: new Date() } });
    return image;
  });
}

export async function retryImageCleanup(actor: MediaActor, jobId: string) {
  return getDatabase().$transaction(async (transaction) => {
    await requireMediaOperator(transaction, actor);
    const changed = await transaction.storageDeletionJob.updateMany({
      where: { id: jobId, storeId: actor.storeId, status: "BLOCKED" },
      data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(), lockedUntil: null, claimToken: null, lastErrorCode: null },
    });
    if (changed.count !== 1) throw new Error("CLEANUP_NOT_RETRYABLE");
    await transaction.storeAuditEvent.create({ data: { storeId: actor.storeId, actorId: actor.userId, action: "IMAGE_CLEANUP_RETRY", reference: jobId } });
  });
}

export async function processStorageDeletions(now?: Date, batchSize = 20, onlyJobIds?: string[]) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 50) throw new Error("INVALID_BATCH_SIZE");
  const database = getDatabase();
  const counts = { completed: 0, retry: 0, blocked: 0, stale: 0 };
  const startedAt = Date.now();
  for (let index = 0; index < batchSize; index++) {
    if (index > 0 && Date.now() - startedAt >= 35_000) break;
    const claimedAt = now ?? new Date();
    const job = await database.$transaction(async (transaction) => {
      const candidates = await transaction.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "StorageDeletionJob"
        WHERE (("status" = 'PENDING' AND "nextAttemptAt" <= ${claimedAt})
           OR ("status" = 'PROCESSING' AND "lockedUntil" <= ${claimedAt}))
          AND (${onlyJobIds === undefined} OR "id" = ANY(${onlyJobIds ?? []}::text[]))
        ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!candidates.length) return null;
      const current = await transaction.storageDeletionJob.findUniqueOrThrow({ where: { id: candidates[0].id } });
      if (current.attempts >= MAX_ATTEMPTS) {
        return transaction.storageDeletionJob.update({ where: { id: current.id }, data: { status: "BLOCKED", claimToken: null, lockedUntil: null, lastErrorCode: "ATTEMPTS_EXHAUSTED" } });
      }
      return transaction.storageDeletionJob.update({ where: { id: current.id }, data: {
        status: "PROCESSING", claimToken: randomUUID(), lockedUntil: new Date(claimedAt.getTime() + STORAGE_DELETION_LEASE_MS), attempts: { increment: 1 },
      } });
    });
    if (!job) break;
    if (job.status === "BLOCKED") { counts.blocked++; continue; }
    const owned = { id: job.id, status: "PROCESSING", claimToken: job.claimToken };
    const referenced = await database.productImage.findUnique({ where: { storagePath: job.storagePath }, select: { id: true } });
    if (!validObject(job) || referenced) {
      const saved = await database.storageDeletionJob.updateMany({ where: owned, data: {
        status: "BLOCKED", claimToken: null, lockedUntil: null,
        lastErrorCode: referenced ? "OBJECT_STILL_REFERENCED" : "INVALID_STORAGE_PATH",
      } });
      if (saved.count) counts.blocked++; else counts.stale++;
      continue;
    }
    try {
      // Supabase remove is idempotent for an already absent object. Only 404 is
      // accepted as absence; permission/network failures remain retryable.
      const { error } = await createStorageAdminClient().storage.from(job.bucket).remove([job.storagePath]);
      if (error && String(error.statusCode) !== "404") throw new Error("STORAGE_REMOVE_FAILED");
      const saved = await database.storageDeletionJob.updateMany({ where: owned, data: {
        status: "COMPLETED", completedAt: new Date(), claimToken: null, lockedUntil: null, lastErrorCode: null,
      } });
      if (saved.count) counts.completed++; else counts.stale++;
    } catch {
      // This also covers a DB failure after Storage succeeded. Replaying remove
      // is safe. If the DB remains down, the durable lease is resumed next run.
      const terminal = job.attempts >= MAX_ATTEMPTS;
      const saved = await database.storageDeletionJob.updateMany({ where: owned, data: {
        status: terminal ? "BLOCKED" : "PENDING", claimToken: null, lockedUntil: null,
        lastErrorCode: "STORAGE_CLEANUP_FAILED", nextAttemptAt: new Date(claimedAt.getTime() + Math.min(3_600_000, 30_000 * 2 ** job.attempts)),
      } });
      if (!saved.count) counts.stale++; else if (terminal) counts.blocked++; else counts.retry++;
    }
  }
  return counts;
}
