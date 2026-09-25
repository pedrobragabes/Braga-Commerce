import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase } from "../../lib/database";
import { removeStoredProductImage } from "../../lib/storage/product-images";
import { finishImageUpload, prepareImageUpload, processStorageDeletions, retryImageCleanup } from "../../lib/storage/deletion-outbox";
import { defaultStoreTheme } from "../../lib/store-theme";
import { POST as cleanupRoute } from "../../app/api/jobs/storage/cleanup/route";

const { remove } = vi.hoisted(() => ({ remove: vi.fn() }));
vi.mock("../../lib/storage/admin", () => ({ createStorageAdminClient: () => ({ storage: { from: () => ({ remove }) } }) }));
const rawUrl = process.env.BRAGA_TEST_DATABASE_URL;
if (rawUrl) {
  const url = new URL(rawUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/braga_integrity_test') throw new Error("Banco de integração recusado");
  process.env.DATABASE_URL = rawUrl;
  delete process.env.DATABASE_SSL_CA;
}

describe.skipIf(!rawUrl)("exclusão e compensação durável de mídia", () => {
  let database: ReturnType<typeof getDatabase>;
  let storeId: string, productId: string;
  let actor: { storeId: string; userId: string };
  const bucket = "product-images";
  beforeAll(() => { database = getDatabase(); });
  beforeEach(async () => {
    remove.mockReset().mockResolvedValue({ error: null });
    const store = await database.store.create({ data: { name: "Mídia sintética", slug: `media-${randomUUID()}` } });
    storeId = store.id;
    const user = await database.user.create({ data: { storeId, name: "Operador", email: `${storeId}@example.test`, role: "OWNER" } });
    actor = { userId: user.id, storeId };
    const product = await database.product.create({ data: { storeId, slug: "produto", name: "Produto de teste", basePriceCents: 100 } });
    productId = product.id;
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await database.storageDeletionJob.deleteMany({ where: { storeId } });
    await database.store.delete({ where: { id: storeId } });
  });
  afterAll(async () => { await database.$disconnect(); });
  const storagePath = () => `${storeId}/${productId}/${randomUUID()}.png`;
  async function image() {
    return database.productImage.create({ data: { productId, storagePath: storagePath(), storageBucket: bucket, url: "https://cdn.example.test/fixture.png" } });
  }
  async function queue() {
    const row = await image();
    await removeStoredProductImage({ ...actor, productId, imageId: row.id });
    return database.storageDeletionJob.findUniqueOrThrow({ where: { imageId: row.id } });
  }

  it("retira referência e agenda atomico; exclusões concorrentes não duplicam job nem tocam Storage antes do commit", async () => {
    const row = await image();
    await Promise.all([removeStoredProductImage({ ...actor, productId, imageId: row.id }), removeStoredProductImage({ ...actor, productId, imageId: row.id })]);
    expect(remove).not.toHaveBeenCalled();
    expect(await database.productImage.findUnique({ where: { id: row.id } })).toBeNull();
    expect(await database.storageDeletionJob.count({ where: { imageId: row.id } })).toBe(1);
    const results = await Promise.all([processStorageDeletions(), processStorageDeletions()]);
    expect(results.reduce((sum, result) => sum + result.completed, 0)).toBe(1);
    expect(remove).toHaveBeenCalledExactlyOnceWith([row.storagePath]);
  });

  it("falha de gravação após retirar referência desfaz imagem/journal e não remove objeto", async () => {
    const row = await image();
    // Real PostgreSQL failure at the LAST write: the image has been deleted
    // and the outbox row inserted inside the transaction before this trigger.
    if (!/^[a-z0-9]+$/.test(storeId)) throw new Error("Unsafe fixture ID");
    await database.$executeRawUnsafe('CREATE FUNCTION fixture_media_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION \'synthetic-audit-write-failure\'; END; $$');
    try {
      await database.$executeRawUnsafe(`CREATE TRIGGER fixture_media_audit_failure BEFORE INSERT ON "StoreAuditEvent" FOR EACH ROW WHEN (NEW."storeId" = '${storeId}' AND NEW."action" = 'PRODUCT_IMAGE_REMOVED') EXECUTE FUNCTION fixture_media_audit_failure()`);
      await expect(removeStoredProductImage({ ...actor, productId, imageId: row.id })).rejects.toThrow();
    } finally {
      await database.$executeRawUnsafe('DROP TRIGGER IF EXISTS fixture_media_audit_failure ON "StoreAuditEvent"');
      await database.$executeRawUnsafe('DROP FUNCTION fixture_media_audit_failure()');
    }
    expect(await database.productImage.findUnique({ where: { id: row.id } })).not.toBeNull();
    expect(await database.storageDeletionJob.count({ where: { imageId: row.id } })).toBe(0);
    expect(remove).not.toHaveBeenCalled();
  });

  it("falha do Storage retém job e retry remove uma vez após backoff", async () => {
    const job = await queue();
    const now = new Date();
    remove.mockResolvedValueOnce({ error: { statusCode: "503", message: "secret-provider-detail" } });
    expect(await processStorageDeletions(now)).toMatchObject({ retry: 1 });
    const retry = await database.storageDeletionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(retry).toMatchObject({ status: "PENDING", attempts: 1, lastErrorCode: "STORAGE_CLEANUP_FAILED" });
    expect(JSON.stringify(retry)).not.toContain("secret-provider-detail");
    expect(await processStorageDeletions(now)).toMatchObject({ completed: 0 });
    expect(await processStorageDeletions(new Date(now.getTime() + 65_000))).toMatchObject({ completed: 1 });
  });

  it("DB falha após exclusão externa; replay aceita objeto ausente sem perder journal", async () => {
    const job = await queue(); const now = new Date();
    vi.spyOn(database.storageDeletionJob, "updateMany").mockRejectedValueOnce(new Error("synthetic-db-after-storage"));
    expect(await processStorageDeletions(now)).toMatchObject({ retry: 1 });
    remove.mockResolvedValueOnce({ error: { statusCode: "404" } });
    expect(await processStorageDeletions(new Date(now.getTime() + 65_000))).toMatchObject({ completed: 1 });
    expect(await database.storageDeletionJob.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({ status: "COMPLETED", attempts: 2, claimToken: null });
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it("retoma processo interrompido, limita tentativas e permite retry administrativo auditado", async () => {
    const job = await queue();
    await database.storageDeletionJob.update({ where: { id: job.id }, data: { status: "PROCESSING", lockedUntil: new Date(0), claimToken: randomUUID(), attempts: 10 } });
    expect(await processStorageDeletions()).toMatchObject({ blocked: 1 });
    expect(remove).not.toHaveBeenCalled();
    await database.user.update({ where: { id: actor.userId }, data: { role: "STAFF" } });
    await expect(retryImageCleanup(actor, job.id)).rejects.toThrow("FORBIDDEN");
    await database.user.update({ where: { id: actor.userId }, data: { role: "ADMIN" } });
    await retryImageCleanup(actor, job.id);
    expect(await processStorageDeletions()).toMatchObject({ completed: 1 });
    expect(await database.storeAuditEvent.count({ where: { storeId, action: "IMAGE_CLEANUP_RETRY", reference: job.id } })).toBe(1);
  });

  it("bloqueia path de outra loja e objeto ainda referenciado", async () => {
    const job = await queue();
    await database.storageDeletionJob.update({ where: { id: job.id }, data: { storagePath: `another-store/${productId}/photo.png` } });
    expect(await processStorageDeletions()).toMatchObject({ blocked: 1 });
    const other = await image();
    await database.storageDeletionJob.create({ data: { storeId, productId, actorId: actor.userId, bucket, storagePath: other.storagePath!, reason: "UPLOAD_COMPENSATION" } });
    expect(await processStorageDeletions()).toMatchObject({ blocked: 1 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("upload vinculado cancela compensação; exclusão posterior reutiliza journal", async () => {
    const job = await prepareImageUpload(actor, { productId, bucket, storagePath: storagePath() });
    const row = await finishImageUpload(actor, { jobId: job.id, productId, url: "https://cdn.example.test/upload.png", alt: null });
    expect(await processStorageDeletions(new Date(Date.now() + 20 * 60_000))).toMatchObject({ completed: 0 });
    expect(remove).not.toHaveBeenCalled();
    await removeStoredProductImage({ ...actor, productId, imageId: row.id });
    expect(await processStorageDeletions()).toMatchObject({ completed: 1 });
    expect(await database.storageDeletionJob.count({ where: { storeId } })).toBe(1);
  });

  it("falha do vínculo e interrupção após upload deixam compensação durável; finalização tardia não ressuscita arquivo", async () => {
    const job = await prepareImageUpload(actor, { productId, bucket, storagePath: storagePath() });
    vi.spyOn(database, "$transaction").mockRejectedValueOnce(new Error("synthetic-attachment-failure"));
    await expect(finishImageUpload(actor, { jobId: job.id, productId, url: "https://cdn.example.test/upload.png", alt: null })).rejects.toThrow("synthetic-attachment-failure");
    expect(await database.productImage.count({ where: { productId } })).toBe(0);
    expect(await processStorageDeletions(new Date(job.nextAttemptAt.getTime() + 1))).toMatchObject({ completed: 1 });
    await expect(finishImageUpload(actor, { jobId: job.id, productId, url: "https://cdn.example.test/upload.png", alt: null })).rejects.toThrow("UPLOAD_CLEANUP_STARTED");
  });

  it("STAFF, loja alheia e imagem usada pelo tema não removem mídia", async () => {
    const row = await image();
    await database.user.update({ where: { id: actor.userId }, data: { role: "STAFF" } });
    await expect(removeStoredProductImage({ ...actor, productId, imageId: row.id })).rejects.toThrow("FORBIDDEN");
    await database.user.update({ where: { id: actor.userId }, data: { role: "OWNER" } });
    await expect(removeStoredProductImage({ ...actor, storeId: "other-store", productId, imageId: row.id })).rejects.toThrow("FORBIDDEN");
    const other = await database.store.create({ data: { name: "Outra loja de mídia", slug: `media-other-${randomUUID()}` } });
    try {
      const otherOwner = await database.user.create({ data: { storeId: other.id, name: "Outro dono", email: `${other.id}@example.test`, role: "OWNER" } });
      await expect(removeStoredProductImage({ userId: otherOwner.id, storeId: other.id, productId, imageId: row.id })).rejects.toThrow("PRODUCT_NOT_FOUND");
    } finally { await database.store.delete({ where: { id: other.id } }); }
    const content = { ...defaultStoreTheme({ name: "Tema", slug: "media-test" }), logoImageId: row.id };
    await database.storeThemeRevision.create({ data: { storeId, version: 1, actorId: actor.userId, content } });
    await database.storeSettings.create({ data: { storeId, themeVersion: 1, themePublishedVersion: 1 } });
    await expect(removeStoredProductImage({ ...actor, productId, imageId: row.id })).rejects.toThrow("IMAGE_USED_BY_THEME");
    expect(await database.productImage.findUnique({ where: { id: row.id } })).not.toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });

  it("API do worker rejeita chamada sem credencial de job", async () => {
    const response = await cleanupRoute(new Request("http://localhost/api/jobs/storage/cleanup", { method: "POST" }));
    expect(response.status).toBe(401); expect(remove).not.toHaveBeenCalled();
  });
});
