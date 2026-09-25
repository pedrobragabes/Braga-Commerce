import { createHmac, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase } from "../../lib/database";
import { createPendingOrder } from "../../lib/orders";
import { createOrderPreference } from "../../lib/mercado-pago/preference";
import { bindOrderPaymentAccount } from "../../lib/mercado-pago/accounts";
import { processMercadoPagoPayment } from "../../lib/mercado-pago/webhook";
import { POST as webhookRoute } from "../../app/api/webhooks/mercadopago/route";
import { configureSyntheticPayments, syntheticPaymentAccount } from "./payment-fixture";

const provider = vi.hoisted(() => ({ get: vi.fn(), create: vi.fn(), preferenceGet: vi.fn() }));
vi.mock("mercadopago", async (original) => ({ ...await original<typeof import("mercadopago")>(),
  Payment: class {
    constructor(private config: { accessToken: string }) {}
    get(input: { id: string }) { return provider.get(this.config.accessToken, input.id); }
  },
  Preference: class {
    constructor(private config: { accessToken: string }) {}
    create(input: unknown) { return provider.create(this.config.accessToken, input); }
    get(input: { preferenceId: string }) { return provider.preferenceGet(this.config.accessToken, input.preferenceId); }
  },
}));
const rawUrl = process.env.BRAGA_TEST_DATABASE_URL;
if (rawUrl) {
  const url = new URL(rawUrl);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/braga_integrity_test') throw new Error("Banco local isolado obrigatório");
  process.env.DATABASE_URL = rawUrl;
}

describe.skipIf(!rawUrl)("contas Mercado Pago isoladas por loja", () => {
  let database: ReturnType<typeof getDatabase>;
  type Shop = { id: string; slug: string; productId: string };
  let shops: Shop[];
  let accounts: ReturnType<typeof syntheticPaymentAccount>[];
  const payments = new Map<string, Record<string, unknown>>();
  const preferences = new Map<string, Record<string, unknown>>();
  beforeAll(() => { database = getDatabase(); });
  beforeEach(async () => {
    shops = []; payments.clear(); preferences.clear();
    provider.get.mockReset(); provider.create.mockReset(); provider.preferenceGet.mockReset();
    for (let index = 0; index < 2; index++) {
      const store = await database.store.create({ data: { salesAccessMode: "LEGACY_PILOT", name: `Pagamento sintético ${index}`, slug: `payment-${randomUUID()}`, domain: `payment-${index}.example.test` } });
      const product = await database.product.create({ data: { storeId: store.id, name: "Produto sintético", slug: "produto", basePriceCents: 1500, stockQuantity: 10 } });
      shops.push({ id: store.id, slug: store.slug, productId: product.id });
    }
    accounts = shops.map((shop, index) => syntheticPaymentAccount(shop.id, { environment: index ? "production" : "sandbox" }));
    configureSyntheticPayments(accounts, accounts[0].key);
    process.env.STORE_PUBLIC_ALLOWED_HOSTS = "payment-0.example.test,payment-1.example.test";
    provider.get.mockImplementation((token, id) => {
      const response = payments.get(`${token}:${id}`); if (!response) throw new Error("SYNTHETIC_PAYMENT_NOT_FOUND"); return response;
    });
    provider.create.mockImplementation((token, input) => {
      const account = accounts.find((item) => item.accessToken === token); if (!account) throw new Error("SYNTHETIC_ACCOUNT_NOT_FOUND");
      const response = { id: `preference-${input.body.external_reference}`, collector_id: Number(account.collectorId), external_reference: input.body.external_reference,
        sandbox_init_point: "https://sandbox.mercadopago.com.br/checkout/fixture", init_point: "https://www.mercadopago.com.br/checkout/fixture" };
      preferences.set(`${token}:${response.id}`, response); return response;
    });
    provider.preferenceGet.mockImplementation((token, id) => preferences.get(`${token}:${id}`));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    const ids = shops.map((shop) => shop.id);
    const keys = accounts.map((account) => `mercadopago:${account.key}:`);
    await database.paymentEvent.deleteMany({ where: { OR: [{ order: { storeId: { in: ids } } }, ...keys.map((prefix) => ({ eventKey: { startsWith: prefix } }))] } });
    await database.order.deleteMany({ where: { storeId: { in: ids } } });
    await database.paymentAccountBinding.deleteMany({ where: { storeId: { in: ids } } });
    await database.customer.deleteMany({ where: { storeId: { in: ids } } });
    await database.store.deleteMany({ where: { id: { in: ids } } });
  });
  afterAll(async () => { await database.$disconnect(); });
  function order(index = 0) {
    return createPendingOrder({ storeSlug: shops[index].slug, items: [{ productId: shops[index].productId, quantity: 1 }],
      customer: { name: "Cliente sintético", phone: "00000000000", email: "synthetic@example.test" }, deliveryMethod: "LOCAL_PICKUP" });
  }
  function payment(index: number, orderId: string, id = "101", extra: Record<string, unknown> = {}) {
    const account = accounts[index];
    const value = { id: Number(id), status: "approved", external_reference: orderId, transaction_amount: 15, currency_id: "BRL",
      collector_id: Number(account.collectorId), live_mode: account.environment === "production", metadata: { order_id: orderId, account_key: account.key, store_id: account.storeId }, ...extra };
    payments.set(`${account.accessToken}:${id}`, value); return value;
  }
  function signedRequest(index: number, id: string, targetKey: string | null = accounts[index].key) {
    const timestamp = Math.floor(Date.now() / 1000); const requestId = "synthetic-request";
    const signature = createHmac("sha256", accounts[index].webhookSecret).update(`id:${id};request-id:${requestId};ts:${timestamp};`).digest("hex");
    return new Request(`https://webhook.example.test/api/webhooks/mercadopago?data.id=${id}${targetKey ? `&account=${targetKey}` : ""}`, {
      method: "POST", headers: { "content-type": "application/json", "x-request-id": requestId, "x-signature": `ts=${timestamp},v1=${signature}` },
      body: JSON.stringify({ type: "payment", data: { id }, action: "payment.updated" }),
    });
  }

  it("duas preferências usam token, recebedor, ambiente, metadata e callback próprios sem expor secrets", async () => {
    const a = await order(0), b = await order(1);
    const responses = await Promise.all([createOrderPreference(a.id), createOrderPreference(b.id)]);
    expect(responses.map((response) => response.environment)).toEqual(["sandbox", "production"]);
    expect(provider.create.mock.calls.map(([token]) => token).sort()).toEqual(accounts.map((account) => account.accessToken).sort());
    for (const [token, input] of provider.create.mock.calls) {
      const account = accounts.find((item) => item.accessToken === token)!;
      expect(input.body.metadata).toMatchObject({ account_key: account.key, store_id: account.storeId });
      expect(input.body.notification_url).toContain(`account=${account.key}`);
      expect(input.requestOptions.idempotencyKey).toContain(account.key);
      expect(JSON.stringify(responses)).not.toContain(account.accessToken); expect(JSON.stringify(responses)).not.toContain(account.webhookSecret);
    }
    expect((await database.order.findUniqueOrThrow({ where: { id: a.id } })).paymentAccountKey).toBe(accounts[0].key);
    expect((await database.order.findUniqueOrThrow({ where: { id: b.id } })).paymentAccountKey).toBe(accounts[1].key);
  });

  it("assinatura A não abre conta B; endpoint antigo exige binding explícito antes de consultar provedor", async () => {
    expect((await webhookRoute(signedRequest(0, "101", accounts[1].key))).status).toBe(401);
    delete process.env.MERCADO_PAGO_LEGACY_ACCOUNT_KEY;
    expect((await webhookRoute(signedRequest(0, "101", null))).status).toBe(503);
    expect(provider.get).not.toHaveBeenCalled();
  });

  it("conta A não aplica pagamento ao pedido B e não anexa evento à loja alheia", async () => {
    const b = await order(1); await bindOrderPaymentAccount(b.id);
    payment(0, b.id);
    expect(await processMercadoPagoPayment("101", null, "payment.updated", accounts[0].key)).toMatchObject({ result: "STORE_MISMATCH", orderId: null });
    expect(await database.order.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ paymentStatus: "WAITING_PAYMENT", inventoryStatus: "RESERVED" });
    expect(await database.paymentEvent.count({ where: { orderId: b.id } })).toBe(0);
    expect(provider.get).toHaveBeenCalledExactlyOnceWith(accounts[0].accessToken, "101");
  });

  it.each([
    ["COLLECTOR_MISMATCH", { collector_id: 999 }], ["ENVIRONMENT_MISMATCH", { live_mode: true }],
    ["CURRENCY_MISMATCH", { currency_id: "USD" }], ["AMOUNT_MISMATCH", { transaction_amount: 1 }],
    ["PAYMENT_ID_MISMATCH", { id: 102 }], ["METADATA_MISMATCH", { metadata: { store_id: "other", account_key: "other" } }],
  ])("rejeita %s antes de alterar pagamento/estoque/outbox", async (result, change) => {
    const saved = await order(); await bindOrderPaymentAccount(saved.id); payment(0, saved.id, "101", change as Record<string, unknown>);
    expect(await processMercadoPagoPayment("101", null, "payment.updated", accounts[0].key)).toMatchObject({ result });
    expect(await database.order.findUniqueOrThrow({ where: { id: saved.id } })).toMatchObject({ paymentStatus: "WAITING_PAYMENT", inventoryStatus: "RESERVED" });
    expect(await database.emailOutbox.count({ where: { orderId: saved.id, type: "PAYMENT_CONFIRMED" } })).toBe(0);
  });

  it("IDs iguais em contas distintas não colidem; replay e evento antigo não alteram aprovação", async () => {
    const a = await order(), b = await order(1);
    await Promise.all([bindOrderPaymentAccount(a.id), bindOrderPaymentAccount(b.id)]);
    payment(0, a.id); payment(1, b.id);
    const apply = () => Promise.all(accounts.map((account) => processMercadoPagoPayment("101", null, "payment.updated", account.key)));
    expect((await apply()).map((value) => value.result)).toEqual(["APPLIED", "APPLIED"]);
    expect((await apply()).map((value) => value.result)).toEqual(["DUPLICATE", "DUPLICATE"]);
    payment(0, a.id, "101", { status: "rejected" });
    expect((await processMercadoPagoPayment("101", null, "payment.updated", accounts[0].key)).result).toBe("IGNORED_STALE");
    expect(await database.order.count({ where: { id: { in: [a.id, b.id] }, paymentStatus: "PAID", inventoryStatus: "COMMITTED" } })).toBe(2);
    expect(await database.emailOutbox.count({ where: { orderId: { in: [a.id, b.id] }, type: "PAYMENT_CONFIRMED" } })).toBe(2);
  });

  it("preferências concorrentes mantêm a mesma conta/chave idempotente", async () => {
    const saved = await order();
    const responses = await Promise.all([createOrderPreference(saved.id), createOrderPreference(saved.id)]);
    expect(responses[0]).toEqual(responses[1]);
    expect(new Set(provider.create.mock.calls.map(([, input]) => input.requestOptions.idempotencyKey)).size).toBe(1);
    expect(await database.paymentAccountBinding.count({ where: { storeId: shops[0].id } })).toBe(1);
  });

  it("binding imutável recusa reutilizar key com outro ambiente/recebedor", async () => {
    const saved = await order(); await bindOrderPaymentAccount(saved.id);
    configureSyntheticPayments([{ ...accounts[0], environment: "production" }, accounts[1]], accounts[0].key);
    await expect(createOrderPreference(saved.id)).rejects.toMatchObject({ code: "PAYMENT_ACCOUNT_IDENTITY_CHANGED" });
    configureSyntheticPayments([{ ...accounts[0], collectorId: "987654321000" }, accounts[1]], accounts[0].key);
    await expect(processMercadoPagoPayment("101", null, "payment.updated", accounts[0].key)).rejects.toMatchObject({ code: "PAYMENT_ACCOUNT_IDENTITY_CHANGED" });
    expect(provider.create).not.toHaveBeenCalled(); expect(provider.get).not.toHaveBeenCalled();
  });

  it("nova key atende pedidos novos; conta antiga desabilitada continua recebendo confirmação e reembolso", async () => {
    const old = await order(); await createOrderPreference(old.id);
    const rotated = syntheticPaymentAccount(shops[0].id, { key: `rotated-${shops[0].id}`, accessToken: "synthetic-rotated-token", webhookSecret: "synthetic-rotated-secret" });
    accounts[0].newCheckouts = false; accounts.push(rotated); configureSyntheticPayments(accounts, accounts[0].key);
    const fresh = await order(); await createOrderPreference(fresh.id);
    expect((await database.order.findUniqueOrThrow({ where: { id: fresh.id } })).paymentAccountKey).toBe(rotated.key);
    expect((await database.order.findUniqueOrThrow({ where: { id: old.id } })).paymentAccountKey).toBe(accounts[0].key);
    payment(0, old.id);
    expect((await webhookRoute(signedRequest(0, "101"))).status).toBe(200);
    payment(0, old.id, "101", { status: "refunded" });
    expect((await processMercadoPagoPayment("101", null, "payment.updated", accounts[0].key)).result).toBe("APPLIED");
    expect(await database.order.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({ paymentStatus: "REFUNDED", inventoryStatus: "COMMITTED" });
  });

  it("conta removida e loja sem credencial falham fechado, sem fallback global", async () => {
    const saved = await order(); await bindOrderPaymentAccount(saved.id);
    configureSyntheticPayments([accounts[1]]);
    await expect(createOrderPreference(saved.id)).rejects.toMatchObject({ code: "PAYMENT_ACCOUNT_NOT_CONFIGURED" });
    const fresh = await order();
    await expect(createOrderPreference(fresh.id)).rejects.toMatchObject({ code: "PAYMENT_NOT_CONFIGURED" });
    expect(provider.create).not.toHaveBeenCalled(); expect(provider.get).not.toHaveBeenCalled();
  });

  it("preferência com recebedor alheio não é salva nem enviada ao cliente", async () => {
    const saved = await order();
    provider.create.mockResolvedValueOnce({ id: "wrong-preference", collector_id: Number(accounts[1].collectorId), external_reference: saved.id, sandbox_init_point: "https://sandbox.mercadopago.com.br/fixture" });
    await expect(createOrderPreference(saved.id)).rejects.toMatchObject({ code: "PREFERENCE_ACCOUNT_MISMATCH" });
    expect((await database.order.findUniqueOrThrow({ where: { id: saved.id } })).mercadoPagoPreferenceId).toBeNull();
  });

  it("evento legado permanece intacto e só ganha vínculo após conta explícita validada", async () => {
    const saved = await order();
    await database.order.update({ where: { id: saved.id }, data: { paymentLegacy: true, mercadoPagoPreferenceId: "legacy-preference", mercadoPagoPaymentId: "101", paymentStatus: "PAID", inventoryStatus: "COMMITTED" } });
    const legacy = await database.paymentEvent.create({ data: { eventKey: "mercadopago:101:approved", provider: "mercadopago", providerEventId: "101", providerStatus: "approved", eventType: "payment.updated", result: "APPLIED", orderId: saved.id } });
    payment(0, saved.id, "101", { metadata: {} });
    expect((await processMercadoPagoPayment("101", null, "payment.updated")).result).toBe("DUPLICATE");
    expect(await database.paymentEvent.findUnique({ where: { id: legacy.id } })).toEqual(legacy);
    expect((await database.order.findUniqueOrThrow({ where: { id: saved.id } })).paymentAccountKey).toBe(accounts[0].key);
    expect(await database.emailOutbox.count({ where: { orderId: saved.id, type: "PAYMENT_CONFIRMED" } })).toBe(0);
    const fresh = await order(); payment(0, fresh.id, "102");
    expect((await processMercadoPagoPayment("102", null, "payment.updated")).result).toBe("ACCOUNT_NOT_BOUND");
  });

  it("falha de binding reverte registro da conta e não chama o provedor", async () => {
    const saved = await order();
    if (!/^[a-z0-9]+$/.test(saved.id)) throw new Error("Unsafe fixture");
    await database.$executeRawUnsafe('CREATE FUNCTION fixture_payment_binding_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION \'synthetic-binding-failure\'; END; $$');
    try {
      await database.$executeRawUnsafe(`CREATE TRIGGER fixture_payment_binding_failure BEFORE UPDATE ON "Order" FOR EACH ROW WHEN (NEW."id" = '${saved.id}' AND NEW."paymentAccountKey" IS NOT NULL) EXECUTE FUNCTION fixture_payment_binding_failure()`);
      await expect(createOrderPreference(saved.id)).rejects.toThrow();
    } finally {
      await database.$executeRawUnsafe('DROP TRIGGER IF EXISTS fixture_payment_binding_failure ON "Order"');
      await database.$executeRawUnsafe('DROP FUNCTION fixture_payment_binding_failure()');
    }
    expect(await database.paymentAccountBinding.count({ where: { storeId: shops[0].id } })).toBe(0);
    expect((await database.order.findUniqueOrThrow({ where: { id: saved.id } })).paymentAccountKey).toBeNull();
    expect(provider.create).not.toHaveBeenCalled();
  });
});
