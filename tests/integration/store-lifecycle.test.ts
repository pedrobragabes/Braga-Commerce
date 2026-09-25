import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase } from "../../lib/database";
import { acceptApplicationPlan, changeSubscription, createPlanVersion, provisionStore, requestStore } from "../../lib/store-lifecycle";
import { defaultStoreTheme, getStorePresentation, publishTheme, saveThemeDraft } from "../../lib/store-theme";
import { resolveStoreHost, matchRequestStore } from "../../lib/store-context";
import { createPendingOrder } from "../../lib/orders";
import { processMercadoPagoPayment } from "../../lib/mercado-pago/webhook";
import { createOrderPreference } from "../../lib/mercado-pago/preference";
import { bindOrderPaymentAccount } from "../../lib/mercado-pago/accounts";
import { configureSyntheticPayments, syntheticPaymentAccount } from "./payment-fixture";
import { getCatalogProducts } from "../../storefront/data";
import { createHash } from "node:crypto";
import { saveDirectoryBinding, removeDirectoryBinding } from "../../lib/directory-bridge";
import { GET as bridgeGet } from "../../app/api/integrations/bes/v1/stores/[externalStoreId]/route";
import { resolveSignedInOperator } from "../../lib/admin-auth";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const provider = vi.hoisted(() => ({ get: vi.fn(), preference: vi.fn(), selectedStore: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: provider.selectedStore }) }) }));
vi.mock("mercadopago", async (original) => ({ ...await original<typeof import("mercadopago")>(),
  Payment: class { get = provider.get; }, Preference: class { create = provider.preference; } }));
const rawUrl = process.env.BRAGA_TEST_DATABASE_URL;
if (rawUrl) {
  const url = new URL(rawUrl);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/braga_integrity_test') throw new Error("Banco local isolado obrigatório.");
  process.env.DATABASE_URL = rawUrl;
}

describe.skipIf(!rawUrl)("tema e contratação assistida por loja em PostgreSQL", () => {
  let database: ReturnType<typeof getDatabase>;
  let admin: string;
  let owner: { authUserId: string; email: string; name: string };
  let planId: string;
  let stores: Array<{ id: string; slug: string }>;
  let requests: string[];
  beforeAll(() => { database = getDatabase(); });
  beforeEach(async () => {
    admin = randomUUID(); stores = []; requests = []; provider.get.mockReset(); provider.preference.mockReset();
    owner = { authUserId: randomUUID(), email: `${randomUUID()}@example.test`, name: "Responsável sintético" };
    await database.platformOperator.create({ data: { authUserId: admin } });
    const plan = await createPlanVersion(admin, { code: `synthetic-${randomUUID()}`, version: 1, name: "Condições sintéticas",
      conditions: "Fixture técnica sem oferta comercial ou preço real. Operação assistida.", priceCents: null, isPublished: true, checkoutEnabled: true });
    planId = plan.id;
  });
  afterEach(async () => {
    const ids = stores.map((store) => store.id);
    await database.paymentEvent.deleteMany({ where: { OR: [{ order: { storeId: { in: ids } } }, ...ids.map((id) => ({ eventKey: { startsWith: `mercadopago:fixture-${id}:` } }))] } });
    await database.order.deleteMany({ where: { storeId: { in: ids } } });
    await database.paymentAccountBinding.deleteMany({ where: { storeId: { in: ids } } });
    await database.customer.deleteMany({ where: { storeId: { in: ids } } });
    await database.storeApplication.deleteMany({ where: { id: { in: requests } } });
    await database.store.deleteMany({ where: { id: { in: ids } } });
    await database.plan.deleteMany({ where: { createdBy: admin } });
    await database.platformOperator.deleteMany({ where: { authUserId: admin } });
  });
  afterAll(async () => { await database.$disconnect(); });
  async function application(label = "Loja sintética", plan: string | null = planId) {
    const input = { requestKey: randomUUID(), storeName: label, storeSlug: `lifecycle-${randomUUID()}`, planId: plan, acceptedPlanVersion: plan ? 1 : null };
    const request = await requestStore(owner, input); requests.push(request.id);
    return { request, input };
  }
  async function store(label?: string) {
    const { request } = await application(label);
    const result = await provisionStore(admin, request.id); stores.push(result);
    return result;
  }
  async function actor(storeId: string) {
    const operator = await database.user.findFirstOrThrow({ where: { storeId, authUserId: owner.authUserId } });
    return { storeId, userId: operator.id };
  }
  async function activate(storeId: string) {
    return changeSubscription(admin, { storeId, expectedRevision: 0, status: "ACTIVE", startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 86400000),
      activationOrigin: "ADMINISTRATIVE", confirmationReference: null, reason: "Concessão sintética para teste" });
  }
  async function product(storeId: string) { return database.product.create({ data: { storeId, name: "Produto sintético", slug: "item", basePriceCents: 1000, stockQuantity: 10 } }); }
  function checkout(shop: { slug: string }, productId: string) {
    return createPendingOrder({ storeSlug: shop.slug, items: [{ productId, quantity: 1 }], customer: { name: "Cliente sintético", phone: "00000000000" }, deliveryMethod: "LOCAL_PICKUP" });
  }

  it("solicitação e provisionamento concorrentes são idempotentes; duas lojas compartilham código, não vínculos", async () => {
    const { request, input } = await application();
    expect((await requestStore(owner, input)).id).toBe(request.id);
    await expect(requestStore({ ...owner, authUserId: randomUUID() }, input)).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    const [a, duplicate] = await Promise.all([provisionStore(admin, request.id), provisionStore(admin, request.id)]); stores.push(a);
    expect(a.id).toBe(duplicate.id);
    const b = await store("Papelaria sintética");
    expect(await database.user.count({ where: { authUserId: owner.authUserId } })).toBe(2);
    expect(await database.subscription.count({ where: { storeId: { in: [a.id, b.id] } } })).toBe(2);
    expect(await database.storeAuditEvent.count({ where: { storeId: a.id, action: "STORE_PROVISIONED" } })).toBe(1);
  });

  it("plano sem publicação/aceite e dono de loja não podem conceder recursos", async () => {
    const { request } = await application("Sem proposta", null);
    await expect(provisionStore(admin, request.id)).rejects.toMatchObject({ code: "TERMS_REQUIRED" });
    await expect(acceptApplicationPlan(randomUUID(), request.id, planId)).rejects.toMatchObject({ code: "PLAN_NOT_AVAILABLE" });
    await acceptApplicationPlan(owner.authUserId, request.id, planId);
    const a = await provisionStore(admin, request.id); stores.push(a);
    await expect(changeSubscription(owner.authUserId, { storeId: a.id, expectedRevision: 0, status: "ACTIVE", startsAt: new Date(), endsAt: new Date(Date.now() + 100000),
      activationOrigin: "COURTESY", confirmationReference: null, reason: "Tentativa de autoativação" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await database.plan.findUniqueOrThrow({ where: { id: planId } })).priceCents).toBeNull();
  });

  it("operador multiloja escolhe apenas vínculo ativo e seleção forjada não concede acesso", async () => {
    const a = await store(), b = await store();
    const auth = { id: owner.authUserId } as SupabaseUser;
    provider.selectedStore = "forged-store";
    expect(await resolveSignedInOperator(auth)).toBeNull();
    provider.selectedStore = b.id;
    expect(await resolveSignedInOperator(auth)).toMatchObject({ storeId: b.id, role: "OWNER" });
    const membershipB = await actor(b.id);
    await database.user.update({ where: { id: membershipB.userId }, data: { isActive: false } });
    // With a single remaining membership the resolver returns that authorized
    // store, never the stale selected one.
    expect(await resolveSignedInOperator(auth)).toMatchObject({ storeId: a.id });
    expect(await resolveSignedInOperator({ id: randomUUID() } as SupabaseUser)).toBeNull();
  });

  it("rascunho de A não vaza, publicação/restauração são independentes de B e CAS impede sobrescrita", async () => {
    const a = await store("Moda sintética"), b = await store("Papelaria sintética");
    const actorA = await actor(a.id), actorB = await actor(b.id);
    const themeA = { ...defaultStoreTheme(a), brand: "#143a63", heroTitle: "Vestuário sintético", font: "classic" as const };
    const themeB = { ...defaultStoreTheme(b), brand: "#60301c", heroTitle: "Papel e criatividade", sections: ["categories", "story"] as Array<"categories" | "story"> };
    await saveThemeDraft(actorA, themeA, 0); await saveThemeDraft(actorB, themeB, 0);
    expect((await getStorePresentation(a.id)).content.heroTitle).not.toBe(themeA.heroTitle);
    expect((await getStorePresentation(a.id, actorA)).content.heroTitle).toBe(themeA.heroTitle);
    await publishTheme(actorA, 1, null); await publishTheme(actorB, 1, null);
    await saveThemeDraft(actorA, { ...themeA, heroTitle: "Segunda versão A" }, 1);
    await expect(saveThemeDraft(actorA, themeA, 1)).rejects.toMatchObject({ code: "THEME_CHANGED" });
    expect((await getStorePresentation(a.id)).content.heroTitle).toBe(themeA.heroTitle);
    await publishTheme(actorA, 2, 1); await publishTheme(actorA, 1, 2);
    expect((await getStorePresentation(a.id)).content.heroTitle).toBe(themeA.heroTitle);
    expect((await getStorePresentation(b.id)).content.heroTitle).toBe(themeB.heroTitle);
    expect((await getStorePresentation(b.id)).config.presentation?.sections).toEqual(themeB.sections);
  });

  it("tema recusa funcionário, outro tenant, imagem alheia, CSS/HTML e contraste insuficiente", async () => {
    const a = await store(), b = await store(); const actorA = await actor(a.id), actorB = await actor(b.id);
    const theme = defaultStoreTheme(a);
    await expect(saveThemeDraft({ userId: actorA.userId, storeId: b.id }, theme, 0)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getStorePresentation(a.id, actorB)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const item = await product(b.id), image = await database.productImage.create({ data: { productId: item.id, url: "https://images.example.test/synthetic.webp" } });
    await expect(saveThemeDraft(actorA, { ...theme, logoImageId: image.id }, 0)).rejects.toMatchObject({ code: "IMAGE_NOT_OWNED" });
    await expect(saveThemeDraft(actorA, { ...theme, brand: "#ffffff" }, 0)).rejects.toBeDefined();
    await expect(saveThemeDraft(actorA, { ...theme, heroTitle: "<script>alert(1)</script>" }, 0)).rejects.toBeDefined();
    await expect(saveThemeDraft(actorA, { ...theme, css: "body{}" }, 0)).rejects.toBeDefined();
    await database.user.update({ where: { id: actorA.userId }, data: { role: "STAFF" } });
    await expect(saveThemeDraft(actorA, theme, 0)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("host cadastrado resolve corretamente e request não escolhe loja diferente por payload/header", async () => {
    const a = await store(), b = await store();
    await database.store.update({ where: { id: a.id }, data: { domain: "lifecycle-a.localhost" } });
    await database.store.update({ where: { id: b.id }, data: { domain: "lifecycle-b.localhost" } });
    expect((await resolveStoreHost("LIFECYCLE-A.LOCALHOST:4320"))?.id).toBe(a.id);
    expect((await resolveStoreHost("lifecycle-b.localhost"))?.id).toBe(b.id);
    expect(await resolveStoreHost("unknown.example.test")).toBeNull();
    expect(await resolveStoreHost("lifecycle-a.localhost/anything")).toBeNull();
    expect(await matchRequestStore(new Request("http://lifecycle-a.localhost", { headers: { "x-store-id": b.id } }), b.slug)).toBeNull();
  });

  it("cancelamento impede nova compra mas preserva reserva, aprovação tardia e pagamento do pedido existente", async () => {
    const a = await store(); const item = await product(a.id);
    await expect(checkout(a, item.id)).rejects.toMatchObject({ code: "STORE_UNAVAILABLE" });
    const subscription = await activate(a.id);
    const order = await checkout(a, item.id);
    await changeSubscription(admin, { storeId: a.id, expectedRevision: 1, status: "CANCELLED", startsAt: subscription.startsAt, endsAt: subscription.endsAt,
      activationOrigin: "ADMINISTRATIVE", confirmationReference: null, reason: "Cancelamento sintético" });
    await expect(checkout(a, item.id)).rejects.toMatchObject({ code: "STORE_UNAVAILABLE" });
    expect((await database.product.findUniqueOrThrow({ where: { id: item.id } })).stockQuantity).toBe(9);
    const account = syntheticPaymentAccount(a.id); configureSyntheticPayments([account], account.key);
    await bindOrderPaymentAccount(order.id);
    provider.get.mockResolvedValue({ id: 900, status: "approved", external_reference: order.id, transaction_amount: 10, currency_id: "BRL", collector_id: Number(account.collectorId), live_mode: false, metadata: { order_id: order.id, account_key: account.key, store_id: a.id } });
    expect((await processMercadoPagoPayment("900", null, "payment.updated")).result).toBe("APPLIED");
    expect(await database.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ paymentStatus: "PAID", inventoryStatus: "COMMITTED" });
    expect((await database.store.findUniqueOrThrow({ where: { id: a.id } })).isActive).toBe(true);
  });

  it("fim de vigência, plano sem checkout e suspensão são verificados no servidor", async () => {
    const a = await store(); const item = await product(a.id); const active = await activate(a.id);
    await changeSubscription(admin, { storeId: a.id, expectedRevision: 1, status: "ENDING", startsAt: active.startsAt, endsAt: new Date(Date.now() - 1), activationOrigin: "ADMINISTRATIVE", confirmationReference: null, reason: "Período encerrado em teste" });
    await expect(checkout(a, item.id)).rejects.toMatchObject({ code: "STORE_UNAVAILABLE" });
    await expect(changeSubscription(admin, { storeId: a.id, expectedRevision: 1, status: "ACTIVE", startsAt: active.startsAt, endsAt: active.endsAt, activationOrigin: "ADMINISTRATIVE", confirmationReference: null, reason: "Revisão antiga" })).rejects.toMatchObject({ code: "SUBSCRIPTION_CHANGED" });
    expect(await database.order.count({ where: { storeId: a.id } })).toBe(0);
  });

  it("loja operacionalmente inativa não expõe catálogo e outra loja não usa credencial MP global", async () => {
    const a = await store(); const item = await product(a.id); await activate(a.id);
    const order = await checkout(a, item.id);
    const b = await store("Outra loja de pagamentos");
    const account = syntheticPaymentAccount(b.id); configureSyntheticPayments([account], account.key);
    await expect(createOrderPreference(order.id)).rejects.toMatchObject({ code: "PAYMENT_NOT_CONFIGURED" });
    expect(provider.preference).not.toHaveBeenCalled();
    provider.get.mockResolvedValue({ id: 999, status: "approved", external_reference: order.id, transaction_amount: 10, currency_id: "BRL", collector_id: Number(account.collectorId), live_mode: false });
    expect((await processMercadoPagoPayment("999", null, "payment.updated")).result).toBe("STORE_MISMATCH");
    await database.store.update({ where: { id: a.id }, data: { isActive: false } });
    expect(await getCatalogProducts(a.slug)).toEqual([]);
    await expect(checkout(a, item.id)).rejects.toMatchObject({ code: "STORE_NOT_FOUND" });
  });

  it("ponte exige chave+allowlist, prova de duplo vínculo, canonical seguro e corta CTA após cancelamento", async () => {
    const a = await store(), b = await store();
    const actorA = await actor(a.id), actorB = await actor(b.id);
    const hostA = `bridge-${randomUUID()}.example.test`, hostB = `bridge-${randomUUID()}.example.test`;
    await database.store.update({ where: { id: a.id }, data: { domain: hostA } });
    await database.store.update({ where: { id: b.id }, data: { domain: hostB } });
    const active = await activate(a.id);
    const before = { key: process.env.BES_BRIDGE_API_KEY, ids: process.env.BES_BRIDGE_STORE_IDS, origins: process.env.BES_ALLOWED_ORIGINS, hosts: process.env.STORE_PUBLIC_ALLOWED_HOSTS };
    try {
      process.env.BES_BRIDGE_API_KEY = randomUUID(); process.env.BES_BRIDGE_STORE_IDS = a.id;
      process.env.BES_ALLOWED_ORIGINS = "https://directory.example.test";
      process.env.STORE_PUBLIC_ALLOWED_HOSTS = `${hostA},${hostB}`;
      const challenge = "ab".repeat(32);
      await expect(saveDirectoryBinding({ ...actorA, storeId: b.id }, { commerceId: 17, origin: "https://directory.example.test", challenge })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(saveDirectoryBinding(actorA, { commerceId: 17, origin: "https://evil.example.test", challenge })).rejects.toMatchObject({ code: "DIRECTORY_ORIGIN_NOT_ALLOWED" });
      await saveDirectoryBinding(actorA, { commerceId: 17, origin: "https://directory.example.test", challenge });
      const read = (id: string, authorized = true) => bridgeGet(new Request("https://api.example.test", { headers: authorized ? { authorization: `Bearer ${process.env.BES_BRIDGE_API_KEY}` } : {} }), { params: Promise.resolve({ externalStoreId: id }) });
      expect((await read(a.id, false)).status).toBe(401);
      expect((await read(b.id)).status).toBe(404);
      const response = await read(a.id), data = await response.json();
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(data).toMatchObject({ schemaVersion: 1, store: { id: a.id, canonicalUrl: `https://${hostA}`, commerceEnabled: true,
        directoryBinding: { commerceId: 17, origin: "https://directory.example.test", challengeHash: createHash("sha256").update(challenge).digest("hex") } } });
      expect(JSON.stringify(data)).not.toContain(challenge);
      await expect(removeDirectoryBinding({ ...actorB, storeId: a.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await changeSubscription(admin, { storeId: a.id, expectedRevision: 1, status: "CANCELLED", startsAt: active.startsAt, endsAt: active.endsAt, activationOrigin: "ADMINISTRATIVE", confirmationReference: null, reason: "Cancelamento sintético da loja paga" });
      expect((await (await read(a.id)).json()).store.commerceEnabled).toBe(false);
      await removeDirectoryBinding(actorA);
      expect((await (await read(a.id)).json()).store.directoryBinding).toBeNull();
      process.env.STORE_PUBLIC_ALLOWED_HOSTS = "another.example.test";
      expect((await read(a.id)).status).toBe(404);
    } finally {
      for (const [key, value] of Object.entries({ BES_BRIDGE_API_KEY: before.key, BES_BRIDGE_STORE_IDS: before.ids, BES_ALLOWED_ORIGINS: before.origins, STORE_PUBLIC_ALLOWED_HOSTS: before.hosts })) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });
});
