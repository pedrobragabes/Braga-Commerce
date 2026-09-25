import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase } from "../../lib/database";
import { createPendingOrder, type OrderCustomerIdentity } from "../../lib/orders";
import { buildCustomerOrderScope } from "../../lib/customer-orders";
import { processEmailOutbox } from "../../lib/email/outbox";
import { POST } from "../../app/api/orders/route";
import { createRateLimitKey } from "../../lib/rate-limit";

const provider = vi.hoisted(() => ({ user: null as null | { id: string; email: string; email_confirmed_at?: string; user_metadata: object } }));
vi.mock("../../lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: provider.user }, error: null }) } }),
}));

const rawUrl = process.env.BRAGA_TEST_DATABASE_URL;
if (rawUrl) {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error("Banco de integração inválido."); }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/braga_integrity_test') {
    throw new Error("Use somente braga_integrity_test local.");
  }
  process.env.DATABASE_URL = rawUrl;
  delete process.env.DATABASE_SSL_CA;
}

describe.skipIf(!rawUrl)("contas e checkout isolados por loja em PostgreSQL", () => {
  let database: ReturnType<typeof getDatabase>;
  let stores: Array<{ id: string; slug: string; productId: string }>;
  let identityA: OrderCustomerIdentity;
  let identityB: OrderCustomerIdentity;
  const envBefore = { driver: process.env.EMAIL_DRIVER, appUrl: process.env.NEXT_PUBLIC_APP_URL,
    resend: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM, hosts: process.env.STORE_PUBLIC_ALLOWED_HOSTS };

  beforeAll(() => { database = getDatabase(); });
  beforeEach(async () => {
    provider.user = null;
    process.env.EMAIL_DRIVER = 'disabled';
    process.env.STORE_PUBLIC_ALLOWED_HOSTS = 'customer-a.localhost,customer-b.localhost';
    process.env.NEXT_PUBLIC_APP_URL = 'https://shop.example.test';
    identityA = { authUserId: randomUUID(), email: 'account-a@example.test' };
    identityB = { authUserId: randomUUID(), email: 'account-b@example.test' };
    stores = [];
    for (const label of ['a', 'b']) {
      const store = await database.store.create({ data: { salesAccessMode: "LEGACY_PILOT", name: `Loja sintética ${label}`, domain: `customer-${label}.localhost`, slug: `customer-${label}-${randomUUID()}` } });
      const product = await database.product.create({ data: { storeId: store.id, name: 'Produto sintético', slug: 'produto', basePriceCents: 1000, stockQuantity: 10 } });
      stores.push({ id: store.id, slug: store.slug, productId: product.id });
    }
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    const storeIds = stores.map((store) => store.id);
    const events = await database.emailOutbox.findMany({ where: { storeId: { in: storeIds } }, select: { id: true } });
    for (const event of events) {
      await unlink(join(process.cwd(), '.local', 'email-capture', `${event.id}.json`)).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
    }
    await database.order.deleteMany({ where: { storeId: { in: storeIds } } });
    await database.customer.deleteMany({ where: { storeId: { in: storeIds } } });
    await database.store.deleteMany({ where: { id: { in: storeIds } } });
    await database.rateLimitBucket.deleteMany({ where: { key: createRateLimitKey('order', '127.0.0.77') } });
  });
  afterAll(async () => {
    for (const [key, value] of Object.entries({ EMAIL_DRIVER: envBefore.driver, NEXT_PUBLIC_APP_URL: envBefore.appUrl, RESEND_API_KEY: envBefore.resend, EMAIL_FROM: envBefore.from, STORE_PUBLIC_ALLOWED_HOSTS: envBefore.hosts })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await database.$disconnect();
  });
  function payload(index = 0) {
    return { storeSlug: stores[index].slug, items: [{ productId: stores[index].productId, quantity: 1 }],
      customer: { name: 'Cliente sintético', phone: '5511999990000', email: 'submitted@example.test' },
      deliveryMethod: 'LOCAL_PICKUP' as const };
  }
  function request(body: unknown) {
    return new Request('http://127.0.0.1/api/orders', { method: 'POST', headers: { 'content-type': 'application/json', 'host': 'customer-a.localhost', 'x-forwarded-for': '127.0.0.77' }, body: JSON.stringify(body) });
  }

  it("a mesma conta tem identidades e histórico separados em duas lojas", async () => {
    const a = await createPendingOrder(payload(0), identityA);
    const b = await createPendingOrder(payload(1), identityA);
    await createPendingOrder(payload(0), identityB);
    const scopedA = await database.order.findMany({ where: buildCustomerOrderScope(stores[0].id, identityA.authUserId) });
    const scopedB = await database.order.findMany({ where: buildCustomerOrderScope(stores[1].id, identityA.authUserId) });
    expect(scopedA.map((order) => order.id)).toEqual([a.id]);
    expect(scopedB.map((order) => order.id)).toEqual([b.id]);
    expect(scopedA[0].customerId).not.toBe(scopedB[0].customerId);
  });

  it("convidado com contato idêntico não entra no histórico nem altera a conta", async () => {
    const signedIn = await createPendingOrder(payload(), identityA);
    const guest = await createPendingOrder({ ...payload(), customer: { ...payload().customer, email: identityA.email, name: 'Contato convidado' } });
    const saved = await database.order.findUniqueOrThrow({ where: { id: guest.id }, include: { customer: true } });
    expect(saved.customer.authUserId).toBeNull();
    expect((await database.order.findMany({ where: buildCustomerOrderScope(stores[0].id, identityA.authUserId) })).map((order) => order.id)).toEqual([signedIn.id]);
    expect(await database.customer.findFirstOrThrow({ where: { authUserId: identityA.authUserId, storeId: stores[0].id } }))
      .toMatchObject({ name: 'Cliente sintético', email: identityA.email });
  });

  it("cadastro posterior não reivindica compra antiga por e-mail ou telefone", async () => {
    const guest = await createPendingOrder({ ...payload(), customer: { ...payload().customer, email: identityA.email } });
    const signedIn = await createPendingOrder(payload(), identityA);
    const visible = await database.order.findMany({ where: buildCustomerOrderScope(stores[0].id, identityA.authUserId) });
    expect(visible.map((order) => order.id)).toEqual([signedIn.id]);
    expect(visible.map((order) => order.id)).not.toContain(guest.id);
  });

  it("API usa identidade e e-mail verificados da sessão, ignorando e-mail submetido", async () => {
    provider.user = { id: identityA.authUserId, email: identityA.email, email_confirmed_at: new Date().toISOString(), user_metadata: { name: 'Nome verificado' } };
    const response = await POST(request({ ...payload(), accountRequired: true }));
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(await database.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { customer: true } }))
      .toMatchObject({ customerEmail: identityA.email, customer: { storeId: stores[0].id, authUserId: identityA.authUserId } });
  });

  it("sessão expirada ou e-mail não verificado não vira pedido de convidado silencioso", async () => {
    expect((await POST(request({ ...payload(), accountRequired: true }))).status).toBe(401);
    provider.user = { id: identityA.authUserId, email: identityA.email, user_metadata: {} };
    expect((await POST(request({ ...payload(), accountRequired: true }))).status).toBe(401);
    expect(await database.order.count({ where: { storeId: stores[0].id } })).toBe(0);
    expect(await database.product.findUniqueOrThrow({ where: { id: stores[0].productId } })).toMatchObject({ stockQuantity: 10 });
  });

  it("guest funciona e IDs de autenticação forjados são recusados no contrato HTTP", async () => {
    expect((await POST(request({ ...payload(), authUserId: identityA.authUserId }))).status).toBe(400);
    const response = await POST(request(payload()));
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(await database.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { customer: true } }))
      .toMatchObject({ customer: { storeId: stores[0].id, authUserId: null, isQuarantined: false } });
  });

  it("FK composta impede ligar pedido de B ao Customer de A", async () => {
    const a = await createPendingOrder(payload(0), identityA);
    const b = await createPendingOrder(payload(1), identityB);
    const customerA = (await database.order.findUniqueOrThrow({ where: { id: a.id } })).customerId;
    await expect(database.order.update({ where: { id: b.id }, data: { customerId: customerA } })).rejects.toMatchObject({ code: 'P2003' });
  });

  it("checkouts concorrentes reutilizam somente a identidade autenticada da própria loja", async () => {
    const secondProduct = await database.product.create({ data: { storeId: stores[0].id, name: 'Outro produto', slug: 'outro', basePriceCents: 1500, stockQuantity: 10 } });
    const orders = await Promise.all([
      createPendingOrder(payload(), identityA),
      createPendingOrder({ ...payload(), items: [{ productId: secondProduct.id, quantity: 1 }] }, identityA),
    ]);
    expect(orders).toHaveLength(2);
    expect(await database.customer.count({ where: { storeId: stores[0].id, authUserId: identityA.authUserId } })).toBe(1);
  });

  it("outbox captura entrega local idempotente e recupera falha sem guardar PII no erro", async () => {
    const order = await createPendingOrder(payload(), identityA);
    process.env.EMAIL_DRIVER = 'resend';
    process.env.EMAIL_FROM = 'fixture@example.test';
    process.env.RESEND_API_KEY = 'local-boundary-test';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('failed secret-token account-a@example.test')));
    expect(await processEmailOutbox()).toMatchObject({ sent: 0, failed: 1 });
    const failed = await database.emailOutbox.findFirstOrThrow({ where: { orderId: order.id } });
    expect(failed).toMatchObject({ status: 'FAILED', attempts: 1, lastErrorCode: 'EMAIL_SEND_FAILED' });
    vi.unstubAllGlobals();
    process.env.EMAIL_DRIVER = 'development';
    expect(await processEmailOutbox(new Date(failed.nextAttemptAt.getTime() + 1))).toMatchObject({ sent: 1, failed: 0 });
    expect(await processEmailOutbox(new Date(failed.nextAttemptAt.getTime() + 1))).toMatchObject({ sent: 0 });
    const captured = JSON.parse(await readFile(join(process.cwd(), '.local', 'email-capture', `${failed.id}.json`), 'utf8'));
    expect(captured).toMatchObject({ to: identityA.email, eventId: failed.id });
    expect(captured.html).toContain(order.id);
    expect(await database.emailOutbox.findUniqueOrThrow({ where: { id: failed.id } })).toMatchObject({ status: 'SENT', attempts: 2 });
  });
});
