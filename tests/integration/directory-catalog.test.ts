import { createHash, randomBytes, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase } from "../../lib/database";
import { saveDirectoryBinding } from "../../lib/directory-bridge";
import { setCatalogSharing } from "../../lib/catalog-sharing";
import { getDirectoryCatalog } from "../../lib/directory-catalog";
import { checkCatalogQuota } from "../../lib/catalog-rate-limit";
import { GET } from "../../app/api/integrations/bes/v2/stores/[externalStoreId]/catalog/route";
import { GET as GETv1 } from "../../app/api/integrations/bes/v1/stores/[externalStoreId]/route";
import contractFixture from "../fixtures/bes-catalog-v2.json";

const rawUrl = process.env.BRAGA_TEST_DATABASE_URL;
if (rawUrl) {
  const url = new URL(rawUrl);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.pathname !== "/braga_integrity_test") throw new Error("Banco Braga local isolado obrigatório.");
  process.env.DATABASE_URL = rawUrl;
}
const secret = "synthetic-catalog-key-never-used-remotely-000";
const origin = "https://directory.example.test";
const challenge = "ab".repeat(32);
const digest = (key: string) => createHash("sha256").update(key).digest("hex");

describe.skipIf(!rawUrl)("catálogo BES v2 e consentimento em PostgreSQL separado", () => {
  let database: ReturnType<typeof getDatabase>;
  let stores: string[];
  let keys: string[];
  let quotaStores: string[];
  let readerId: string;
  beforeAll(() => { database = getDatabase(); });
  beforeEach(() => {
    stores = []; keys = []; quotaStores = [];
    readerId = "catalog-key-" + randomUUID(); keys.push(readerId);
    vi.stubEnv("BES_CATALOG_ENABLED", "true"); vi.stubEnv("BES_CATALOG_KEY_ID", readerId);
    vi.stubEnv("BES_CATALOG_API_KEY", secret); vi.stubEnv("BES_CATALOG_PREVIOUS_KEY_ID", "");
    vi.stubEnv("BES_CATALOG_PREVIOUS_API_KEY", ""); vi.stubEnv("BES_CATALOG_IMAGE_HOSTS", "images.example.test");
    vi.stubEnv("BES_ALLOWED_ORIGINS", origin); vi.stubEnv("STORE_PUBLIC_ALLOWED_HOSTS", "");
  });
  afterEach(async () => {
    await database.store.deleteMany({ where: { id: { in: stores } } });
    await database.rateLimitBucket.deleteMany({ where: { key: { in: [
      ...keys.map(key => digest("bes-catalog:key:" + key)), ...[...stores, ...quotaStores].map(id => digest("bes-catalog:store:" + id)),
    ] } } });
    vi.unstubAllEnvs();
  });
  afterAll(async () => { await database.$disconnect(); });

  async function shop() {
    const nonce = randomUUID();
    const store = await database.store.create({ data: { name: "Loja sintética catálogo", slug: "catalog-" + nonce,
      domain: "s" + nonce + ".catalog.example.test", salesAccessMode: "LEGACY_PILOT" } });
    stores.push(store.id);
    vi.stubEnv("BES_CATALOG_STORE_IDS", stores.join(","));
    const found = await database.store.findMany({ where: { id: { in: stores } }, select: { domain: true } });
    vi.stubEnv("STORE_PUBLIC_ALLOWED_HOSTS", found.map(store => store.domain).join(","));
    const user = await database.user.create({ data: { storeId: store.id, name: "Responsável sintético", email: nonce + "@example.test", role: "OWNER" } });
    const actor = { userId: user.id, storeId: store.id };
    await saveDirectoryBinding(actor, { commerceId: parseInt(randomBytes(4).toString("hex"), 16) % 2_000_000_000 + 1, origin, challenge });
    return { store, actor };
  }
  async function consent(actor: { userId: string; storeId: string }, enabled = true) {
    const binding = await database.storeDirectoryBinding.findUniqueOrThrow({ where: { storeId: actor.storeId } });
    return setCatalogSharing(actor, { enabled, scopeVersion: 2, expectedRevision: binding.catalogConsentRevision });
  }
  async function product(storeId: string, overrides: { id?: string; slug?: string; isActive?: boolean; stockQuantity?: number; hasVariants?: boolean; basePriceCents?: number } = {}) {
    return database.product.create({ data: { storeId, name: "Produto sintético", slug: "item-" + randomUUID(), basePriceCents: 5000, stockQuantity: 2, ...overrides } });
  }
  const read = (id: string, token = secret, key = readerId) => GET(new Request("https://producer.example.test/api/catalog", {
    headers: { Authorization: "Bearer " + token, "X-BES-Key-Id": key },
  }), { params: Promise.resolve({ externalStoreId: id }) });

  async function waitForProductRead() {
    for (let attempt = 0; attempt < 40; attempt++) {
      const rows = await database.$queryRaw<Array<{ query: string; wait_event_type: string }>>`
        SELECT query, wait_event_type FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()`;
      if (rows.some(row => row.wait_event_type === "Lock" && /FROM "(?:public"\.")?Product"/.test(row.query))) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error("Leitura real não chegou ao bloqueio de Product.");
  }
  async function holdProducts() {
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>(resolve => { enter = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });
    const done = database.$transaction(async tx => {
      await tx.$executeRaw`LOCK TABLE "Product" IN ACCESS EXCLUSIVE MODE`;
      enter(); await released;
    }, { timeout: 5000 });
    await entered;
    return { release, done };
  }

  it("migração preserva vínculo v1 sem transformar em consentimento", async () => {
    const { store, actor } = await shop(); await product(store.id);
    const binding = await database.storeDirectoryBinding.findUniqueOrThrow({ where: { storeId: store.id } });
    expect(binding).toMatchObject({ catalogSharingEnabled: false, catalogConsentActorId: null, catalogConsentAt: null, catalogConsentScopeVersion: null });
    const response = await read(store.id); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ schemaVersion: 2, store: { catalogSharingEnabled: false }, items: [] });
    vi.stubEnv("BES_BRIDGE_API_KEY", secret); vi.stubEnv("BES_BRIDGE_STORE_IDS", store.id);
    const v1 = await GETv1(new Request("https://producer.example.test/api/v1", { headers: { Authorization: "Bearer " + secret } }), { params: Promise.resolve({ externalStoreId: store.id }) });
    expect(v1.status).toBe(200); const body = await v1.json(); expect(body.schemaVersion).toBe(1); expect(body.store).not.toHaveProperty("catalogSharingEnabled");
    await consent(actor); expect((await database.storeAuditEvent.count({ where: { storeId: store.id, action: "DIRECTORY_CATALOG_ENABLED" } }))).toBe(1);
  });

  it("consulta de 12 itens determinísticos omite campos privados, inativos e imagens não públicas", async () => {
    const { store, actor } = await shop(); await consent(actor);
    for (let index = 0; index < 14; index++) {
      const item = await product(store.id, { id: "item-" + randomUUID() + "-" + index.toString().padStart(2, "0"), slug: "item-" + index });
      await database.productImage.create({ data: { productId: item.id, url: index % 2 ? "https://images.example.test/item.webp" : "https://private.example.test/item.webp", storagePath: "private/key-" + index, storageBucket: "private" } });
    }
    await product(store.id, { id: "A-inactive-" + randomUUID(), isActive: false });
    const response = await read(store.id); expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const body = await response.json(); expect(body.items).toHaveLength(12);
    const ids = body.items.map((item: { id: string }) => item.id); expect(ids).toEqual([...ids].sort());
    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual(["availability", "canonicalUrl", "id", "imageUrl", "name", "price", "slug"].sort());
      expect(new URL(item.canonicalUrl).origin).toBe("https://" + store.domain);
      expect(item.imageUrl === null || item.imageUrl === "https://images.example.test/item.webp").toBe(true);
    }
    expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThanOrEqual(65536);
    expect(Date.parse(body.expiresAt) - Date.parse(body.emittedAt)).toBe(60000);
    expect(body.store.directoryBinding.challengeHash).toBe(digest(challenge));
    expect(body).not.toHaveProperty("customer"); expect(body).not.toHaveProperty("orders");
  });

  it("faixa real usa variantes ativas com estoque e fallback de preço; estoque zero não anuncia oferta", async () => {
    const { store, actor } = await shop(); await consent(actor);
    const item = await product(store.id, { hasVariants: true });
    await database.productVariant.createMany({ data: [
      { productId: item.id, name: "Barata esgotada", stockQuantity: 0, priceCents: 100 },
      { productId: item.id, name: "Inativa", stockQuantity: 10, priceCents: 200, isActive: false },
      { productId: item.id, name: "Preço base", stockQuantity: 2, priceCents: null },
      { productId: item.id, name: "Disponível", stockQuantity: 1, priceCents: 6000 },
    ] });
    expect((await (await read(store.id)).json()).items[0].price).toEqual({ currency: "BRL", min: 5000, max: 6000 });
    await database.productVariant.updateMany({ where: { productId: item.id }, data: { stockQuantity: 0 } });
    expect((await (await read(store.id)).json()).items[0]).toMatchObject({ availability: "unavailable", price: null });
  });

  it("sem disponibilidade simples remove o preço; loja inativa e operação sem assinatura não exibem itens", async () => {
    const { store, actor } = await shop(); await consent(actor); await product(store.id, { stockQuantity: 0 });
    expect((await (await read(store.id)).json()).items[0]).toMatchObject({ availability: "unavailable", price: null });
    await database.store.update({ where: { id: store.id }, data: { isActive: false } });
    expect(await (await read(store.id)).json()).toMatchObject({ store: { commerceEnabled: false }, items: [] });
    await database.store.update({ where: { id: store.id }, data: { isActive: true, salesAccessMode: "ASSISTED" } });
    expect(await (await read(store.id)).json()).toMatchObject({ store: { commerceEnabled: false }, items: [] });
  });

  it("admin não dono pode interromper, nunca ativar por outro; outro tenant é recusado", async () => {
    const a = await shop(), b = await shop(); await consent(a.actor);
    const admin = await database.user.create({ data: { storeId: a.store.id, name: "Admin sintético", email: randomUUID() + "@example.test", role: "ADMIN" } });
    const actor = { userId: admin.id, storeId: a.store.id };
    await expect(consent(actor)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await consent(actor, false);
    expect((await (await read(a.store.id)).json()).items).toEqual([]);
    await expect(consent({ userId: b.actor.userId, storeId: a.store.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("revogação, mudança do dono e retorno ao papel anterior exigem novo aceite", async () => {
    const { store, actor } = await shop(); await product(store.id); await consent(actor);
    expect((await (await read(store.id)).json()).items).toHaveLength(1);
    await database.user.update({ where: { id: actor.userId }, data: { role: "ADMIN", updatedAt: new Date(Date.now() + 100) } });
    expect((await (await read(store.id)).json()).items).toEqual([]);
    await database.user.update({ where: { id: actor.userId }, data: { role: "OWNER", updatedAt: new Date(Date.now() + 200) } });
    expect((await (await read(store.id)).json()).items).toEqual([]);
    await consent(actor); expect((await (await read(store.id)).json()).items).toHaveLength(1);
    await consent(actor, false); expect((await (await read(store.id)).json()).items).toEqual([]);
  });

  it("troca do vínculo/prova invalida consentimento e CAS impede autorizar vínculo diferente", async () => {
    const { store, actor } = await shop(); await product(store.id); await consent(actor);
    const prior = await database.storeDirectoryBinding.findUniqueOrThrow({ where: { storeId: store.id } });
    await saveDirectoryBinding(actor, { commerceId: prior.commerceId, origin, challenge: "cd".repeat(32) });
    expect((await (await read(store.id)).json()).items).toEqual([]);
    await expect(setCatalogSharing(actor, { enabled: true, scopeVersion: 2, expectedRevision: prior.catalogConsentRevision })).rejects.toMatchObject({ code: "DIRECTORY_BINDING_CHANGED" });
  });

  it("papel volta no mesmo timestamp e SQL direto não reutiliza consentimento antigo", async () => {
    const { store, actor } = await shop(); await product(store.id); await consent(actor);
    const operator = await database.user.findUniqueOrThrow({ where: { id: actor.userId } });
    await database.user.update({ where: { id: operator.id }, data: { role: "ADMIN", updatedAt: operator.updatedAt } });
    await database.user.update({ where: { id: operator.id }, data: { role: "OWNER", updatedAt: operator.updatedAt } });
    expect((await database.storeDirectoryBinding.findUniqueOrThrow({ where: { storeId: store.id } })).catalogSharingEnabled).toBe(false);
    expect((await (await read(store.id)).json()).items).toEqual([]);
    await consent(actor);
    await database.$executeRaw`UPDATE "User" SET "isActive" = false WHERE "id" = ${actor.userId}`;
    await database.$executeRaw`UPDATE "User" SET "isActive" = true WHERE "id" = ${actor.userId}`;
    expect((await (await read(store.id)).json()).items).toEqual([]);
  });

  it("aceite de tela antiga não autoriza prova nova que conserve o mesmo timestamp", async () => {
    const { store, actor } = await shop();
    const previous = await database.storeDirectoryBinding.findUniqueOrThrow({ where: { storeId: store.id } });
    await saveDirectoryBinding(actor, { commerceId: previous.commerceId, origin, challenge: "ef".repeat(32) });
    await database.storeDirectoryBinding.update({ where: { id: previous.id }, data: { updatedAt: previous.updatedAt } });
    await expect(setCatalogSharing(actor, { enabled: true, scopeVersion: 2, expectedRevision: previous.catalogConsentRevision })).rejects.toMatchObject({ code: "DIRECTORY_BINDING_CHANGED" });
    expect((await database.storeDirectoryBinding.findUniqueOrThrow({ where: { storeId: store.id } })).catalogSharingEnabled).toBe(false);
  });

  it("revogação do dono concluída enquanto a autorização espera a loja impede novo aceite", async () => {
    const { store, actor } = await shop(); await consent(actor);
    const previous = await database.storeDirectoryBinding.findUniqueOrThrow({ where: { storeId: store.id } });
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>(resolve => { enter = resolve; }); const released = new Promise<void>(resolve => { release = resolve; });
    const holder = database.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Store" WHERE "id" = ${store.id} FOR NO KEY UPDATE`; enter(); await released;
    }, { timeout: 5000 });
    await entered;
    const pending = setCatalogSharing(actor, { enabled: true, scopeVersion: 2, expectedRevision: previous.catalogConsentRevision })
      .then(value => ({ value, error: null }), error => ({ value: null, error }));
    let observed = false;
    try {
      for (let attempt = 0; attempt < 40; attempt++) {
        const rows = await database.$queryRaw<Array<{ query: string; wait_event_type: string }>>`
          SELECT query, wait_event_type FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()`;
        if (rows.some(row => row.wait_event_type === "Lock" && row.query.includes('FROM "Store"') && row.query.includes("FOR NO KEY UPDATE"))) { observed = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(observed).toBe(true);
      const revoke = database.user.update({ where: { id: actor.userId }, data: { role: "ADMIN" } });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([revoke, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Revogação ficou bloqueada pela loja.")), 800); })]); }
      finally { if (timer) clearTimeout(timer); }
    } finally { release(); await holder; }
    expect((await pending).error).toMatchObject({ code: "FORBIDDEN" });
    expect((await database.storeDirectoryBinding.findUniqueOrThrow({ where: { storeId: store.id } })).catalogSharingEnabled).toBe(false);
    expect(await database.storeAuditEvent.count({ where: { storeId: store.id, action: "DIRECTORY_CATALOG_ENABLED" } })).toBe(1);
  });

  it("auth/ID/flag/canonical allowlist falham fechados sem fallback de outra loja", async () => {
    const { store } = await shop();
    expect((await read(store.id, "wrong-key")).status).toBe(401);
    expect((await read("unknown-store")).status).toBe(404);
    expect((await read("../other")).status).toBe(404);
    vi.stubEnv("BES_CATALOG_ENABLED", "false"); expect((await read(store.id)).status).toBe(401);
    vi.stubEnv("BES_CATALOG_ENABLED", "true"); vi.stubEnv("STORE_PUBLIC_ALLOWED_HOSTS", "other.example.test");
    expect((await read(store.id)).status).toBe(404);
  });

  it("12 consultas simultâneas são o limite global da loja; bloqueadas não crescem o contador", async () => {
    const { store } = await shop();
    const responses = await Promise.all(Array.from({ length: 20 }, () => read(store.id)));
    expect(responses.filter(response => response.status === 200)).toHaveLength(12);
    expect(responses.filter(response => response.status === 429)).toHaveLength(8);
    for (const response of responses.filter(response => response.status === 429)) expect(Number(response.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    const bucket = await database.rateLimitBucket.findUniqueOrThrow({ where: { key: digest("bes-catalog:store:" + store.id) } });
    expect(bucket.count).toBe(12);
    const second = "catalog-key-" + randomUUID(); keys.push(second);
    expect(await checkCatalogQuota(second, store.id)).toMatchObject({ allowed: false });
  });

  it("60 consultas por chave entre lojas, reset ao expirar, sem alocação ilimitada por tentativa rejeitada", async () => {
    quotaStores = Array.from({ length: 6 }, () => "quota-store-" + randomUUID());
    for (let index = 0; index < 60; index++) expect((await checkCatalogQuota(readerId, quotaStores[index % 6])).allowed).toBe(true);
    expect((await checkCatalogQuota(readerId, quotaStores[0])).allowed).toBe(false);
    expect((await database.rateLimitBucket.findUniqueOrThrow({ where: { key: digest("bes-catalog:key:" + readerId) } })).count).toBe(60);
    await database.rateLimitBucket.updateMany({ where: { key: { in: [digest("bes-catalog:key:" + readerId), ...quotaStores.map(id => digest("bes-catalog:store:" + id))] } }, data: { windowStart: new Date(0), expiresAt: new Date(60000) } });
    expect((await checkCatalogQuota(readerId, quotaStores[0])).allowed).toBe(true);
  });

  it("snapshot real não mistura loja anterior com preço/estoque posterior", async () => {
    const { store, actor } = await shop(); await consent(actor); const item = await product(store.id);
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>(resolve => { enter = resolve; }); const released = new Promise<void>(resolve => { release = resolve; });
    const writer = database.$transaction(async tx => {
      await tx.$executeRaw`LOCK TABLE "Product" IN ACCESS EXCLUSIVE MODE`; enter(); await released;
      await tx.product.update({ where: { id: item.id }, data: { basePriceCents: 9000, stockQuantity: 0 } });
      await tx.store.update({ where: { id: store.id }, data: { isActive: false } });
    }, { timeout: 5000 });
    await entered; const pending = getDirectoryCatalog(store.id);
    try { await waitForProductRead(); } finally { release(); await writer; }
    const before = await pending;
    expect(before).toMatchObject({ store: { commerceEnabled: true }, items: [{ price: { min: 5000, max: 5000 }, availability: "available" }] });
    expect(await getDirectoryCatalog(store.id)).toMatchObject({ store: { commerceEnabled: false }, items: [] });
  });

  it("chave revogada durante I/O não retorna a projeção autorizada antes", async () => {
    const { store, actor } = await shop(); await consent(actor); await product(store.id);
    const hold = await holdProducts(); const pending = read(store.id);
    try { await waitForProductRead(); vi.stubEnv("BES_CATALOG_API_KEY", "revoked-and-replaced-catalog-key-00000000000"); }
    finally { hold.release(); await hold.done; }
    const response = await pending; expect(response.status).toBe(401); expect(await response.json()).toEqual({ error: "UNAUTHORIZED" });
  });

  it("falha/tempo limite de leitura retorna erro genérico sem preço/prova e solta recursos", async () => {
    const { store, actor } = await shop(); await consent(actor); await product(store.id);
    const hold = await holdProducts(); const started = performance.now();
    let response: Response;
    try { response = await read(store.id); } finally { hold.release(); await hold.done; }
    expect(performance.now() - started).toBeLessThan(2500);
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: "TEMPORARILY_UNAVAILABLE" });
    expect((await read(store.id)).status).toBe(200);
  });

  it("constraint persistida não permite consentimento sem ator/data/escopo", async () => {
    const { store } = await shop();
    await expect(database.storeDirectoryBinding.update({ where: { storeId: store.id }, data: { catalogSharingEnabled: true } })).rejects.toBeDefined();
    const binding = await database.storeDirectoryBinding.findUniqueOrThrow({ where: { storeId: store.id } });
    expect(binding.catalogSharingEnabled).toBe(false);
  });

  it("envelope HTTP corresponde à fixture versionada para o consumidor", async () => {
    const { store, actor } = await shop(); await consent(actor);
    await product(store.id, { id: contractFixture.items[0].id, slug: contractFixture.items[0].slug });
    const binding = await database.storeDirectoryBinding.findUniqueOrThrow({ where: { storeId: store.id } });
    const body = await (await read(store.id)).json();
    const canonicalUrl = "https://" + store.domain;
    expect(body).toEqual({ ...contractFixture, store: { ...contractFixture.store, id: store.id, canonicalUrl,
      directoryBinding: { commerceId: binding.commerceId, origin, challengeHash: digest(challenge) } },
      emittedAt: body.emittedAt, expiresAt: body.expiresAt, projectionRevision: body.projectionRevision,
      items: [{ ...contractFixture.items[0], canonicalUrl: canonicalUrl + "/produto/produto-sintetico" }] });
  });
});
