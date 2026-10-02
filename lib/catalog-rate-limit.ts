import { createHash } from "node:crypto";
import { getDatabase } from "./database";

const MINUTE_MS = 60_000;
export async function checkCatalogQuota(keyId: string, storeId: string) {
  return getDatabase().$transaction(async transaction => {
    await transaction.$queryRaw`SELECT set_config('statement_timeout', '750ms', true)`;
    const clock = await transaction.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS "now"`;
    const now = clock[0].now;
    const buckets = [{ key: `bes-catalog:key:${keyId}`, limit: 60 }, { key: `bes-catalog:store:${storeId}`, limit: 12 }]
      .map(bucket => ({ ...bucket, key: createHash("sha256").update(bucket.key).digest("hex") })).sort((a, b) => a.key.localeCompare(b.key));
    // The same keys are locked in the same order across workers/key rotation.
    for (const bucket of buckets) await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${bucket.key}, 0))`;
    const rows = await transaction.rateLimitBucket.findMany({ where: { key: { in: buckets.map(bucket => bucket.key) } } });
    const blocked = buckets.map(bucket => ({ ...bucket, row: rows.find(row => row.key === bucket.key) }))
      .filter(bucket => bucket.row && bucket.row.expiresAt > now && bucket.row.count >= bucket.limit);
    if (blocked.length) return { allowed: false, retryAfter: Math.max(...blocked.map(bucket => Math.max(1, Math.min(60, Math.ceil((bucket.row!.expiresAt.getTime() - now.getTime()) / 1000))))) };
    for (const bucket of buckets) {
      const previous = rows.find(row => row.key === bucket.key);
      const live = previous && previous.expiresAt > now;
      const values = { count: live ? previous.count + 1 : 1, windowStart: live ? previous.windowStart : now,
        expiresAt: live ? previous.expiresAt : new Date(now.getTime() + MINUTE_MS) };
      await transaction.rateLimitBucket.upsert({ where: { key: bucket.key }, create: { key: bucket.key, ...values }, update: values });
    }
    return { allowed: true, retryAfter: 0 };
  }, { maxWait: 100, timeout: 900 });
}
