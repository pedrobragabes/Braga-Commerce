import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase } from "../../lib/database";
import { createPendingOrder } from "../../lib/orders";
import { expirePendingOrders } from "../../lib/order-expiration";
import { processMercadoPagoPayment } from "../../lib/mercado-pago/webhook";
import { adjustAvailableStock } from "../../lib/admin-inventory";
import { saveOrderOperation } from "../../lib/admin-order-operation";
import { resolveOrderInventory } from "../../lib/order-inventory-review";
import { bindOrderPaymentAccount } from "../../lib/mercado-pago/accounts";
import { configureSyntheticPayments, syntheticPaymentAccount } from "./payment-fixture";
import { adjustStock, resolveInventoryReview, saveVariant, updateProduct } from "../../app/admin/actions";

// Only the external payment lookup is replaced. All application code, locks,
// transactions, constraints, reservations, events and outbox use PostgreSQL.
const { getPayment } = vi.hoisted(() => ({ getPayment: vi.fn() }));
const identity = vi.hoisted(() => ({ authUserId: "" }));
vi.mock("../../lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: identity.authUserId } }, error: null }) } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("mercadopago", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mercadopago")>();
  return { ...actual, Payment: class { async get(input: { id: string }) { return { ...await getPayment(input), id: input.id }; } } };
});

const rawUrl = process.env.BRAGA_TEST_DATABASE_URL;
if (rawUrl) {
  let url: URL;
  try { url = new URL(rawUrl); }
  catch { throw new Error("BRAGA_TEST_DATABASE_URL inválida."); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    || url.pathname !== '/braga_integrity_test') {
    throw new Error("Banco de integração recusado: use somente braga_integrity_test local.");
  }
  process.env.DATABASE_URL = rawUrl;
  delete process.env.DATABASE_SSL_CA;
  process.env.MERCADO_PAGO_ACCESS_TOKEN = "local-test-never-sent";
}

describe.skipIf(!rawUrl)("integridade comercial em PostgreSQL", () => {
  let database: ReturnType<typeof getDatabase>;
  let storeId: string;
  let storeSlug: string;
  let productId: string;
  let customerPhone: string;
  let actor: { userId: string; storeId: string };

  beforeAll(() => { database = getDatabase(); });
  beforeEach(async () => {
    getPayment.mockReset();
    storeSlug = `integrity-${randomUUID()}`;
    process.env.MERCADO_PAGO_STORE_SLUG = storeSlug;
    const store = await database.store.create({ data: { salesAccessMode: "LEGACY_PILOT", name: "Loja sintética de integração", slug: storeSlug } });
    storeId = store.id;
    const paymentAccount = syntheticPaymentAccount(storeId);
    configureSyntheticPayments([paymentAccount], paymentAccount.key);
    customerPhone = `fixture-${storeId}`;
    identity.authUserId = randomUUID();
    const operator = await database.user.create({
      data: { storeId, authUserId: identity.authUserId, name: "Operador sintético", email: `${storeId}@example.test`, role: "OWNER" },
    });
    actor = { userId: operator.id, storeId };
    const product = await database.product.create({
      data: { storeId, name: "Produto de teste", slug: "produto", basePriceCents: 1500, stockQuantity: 1 },
    });
    productId = product.id;
  });
  afterEach(async () => {
    await database.paymentEvent.deleteMany({ where: { order: { storeId } } });
    await database.order.deleteMany({ where: { storeId } });
    await database.paymentAccountBinding.deleteMany({ where: { storeId } });
    await database.customer.deleteMany({ where: { phone: customerPhone } });
    await database.store.delete({ where: { id: storeId } });
  });
  afterAll(async () => { await database.$disconnect(); });

  async function createOrder(quantity = 1) {
    const order = await createPendingOrder({
      storeSlug,
      items: [{ productId, quantity }],
      customer: { name: "Cliente sintético", phone: customerPhone, email: "fixture@example.test" },
      deliveryMethod: "LOCAL_PICKUP",
    });
    await bindOrderPaymentAccount(order.id);
    return order;
  }
  function payment(orderId: string, status: string) {
    const account = syntheticPaymentAccount(storeId);
    return { id: 123, status, external_reference: orderId, transaction_amount: 15, currency_id: "BRL", collector_id: Number(account.collectorId), live_mode: false, metadata: { order_id: orderId, account_key: account.key, store_id: storeId } };
  }
  async function stock() {
    return (await database.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity;
  }
  async function eventCount(orderId: string, type: "PAYMENT_CONFIRMED" | "ORDER_CANCELLED" | "PAYMENT_REFUNDED") {
    return database.emailOutbox.count({ where: { orderId, type } });
  }

  it("permite somente um checkout concorrente da última unidade", async () => {
    const results = await Promise.allSettled([createOrder(), createOrder()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await stock()).toBe(0);
    expect(await database.order.count({ where: { storeId } })).toBe(1);
  });

  it("reserva a última unidade de variante atomicamente, sem usar o saldo do produto", async () => {
    await database.product.update({ where: { id: productId }, data: { hasVariants: true, stockQuantity: 30 } });
    const variant = await database.productVariant.create({
      data: { productId, name: "Tamanho único", stockQuantity: 1 },
    });
    const checkout = () => createPendingOrder({
      storeSlug,
      items: [{ productId, variantId: variant.id, quantity: 1 }],
      customer: { name: "Cliente sintético", phone: customerPhone },
      deliveryMethod: "LOCAL_PICKUP",
    });
    const results = await Promise.allSettled([checkout(), checkout()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await database.productVariant.findUniqueOrThrow({ where: { id: variant.id } }))
      .toMatchObject({ stockQuantity: 0 });
    expect(await stock()).toBe(30);
    const order = await database.order.findFirstOrThrow({ where: { storeId } });
    await expirePendingOrders(order.expiresAt!);
    expect(await database.productVariant.findUniqueOrThrow({ where: { id: variant.id } }))
      .toMatchObject({ stockQuantity: 1 });
    expect(await stock()).toBe(30);
  });

  it("expira reserva rejeitada no prazo original uma única vez", async () => {
    const order = await createOrder();
    getPayment.mockResolvedValue(payment(order.id, "rejected"));
    await processMercadoPagoPayment(`rejected-${order.id}`, null, "payment.updated");
    await expirePendingOrders(new Date(order.expiresAt!.getTime() - 1));
    expect(await stock()).toBe(0);
    await Promise.all([expirePendingOrders(order.expiresAt!), expirePendingOrders(order.expiresAt!)]);
    const saved = await database.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved).toMatchObject({ paymentStatus: "CANCELLED", inventoryStatus: "RELEASED" });
    expect(await stock()).toBe(1);
    expect(await eventCount(order.id, "ORDER_CANCELLED")).toBe(1);
  });

  it("processa replays simultâneos de aprovação uma única vez", async () => {
    const order = await createOrder();
    getPayment.mockResolvedValue(payment(order.id, "approved"));
    const results = await Promise.all(Array.from({ length: 3 }, () =>
      processMercadoPagoPayment(`approved-${order.id}`, null, "payment.updated")));
    expect(results.filter((result) => result.result === "APPLIED")).toHaveLength(1);
    expect(results.filter((result) => result.result === "DUPLICATE")).toHaveLength(2);
    expect(await stock()).toBe(0);
    expect(await database.order.findUniqueOrThrow({ where: { id: order.id } }))
      .toMatchObject({ paymentStatus: "PAID", inventoryStatus: "COMMITTED" });
    expect(await eventCount(order.id, "PAYMENT_CONFIRMED")).toBe(1);
  });

  it.each([1, 2, 3, 4, 5])("serializa aprovação vs expiração sem saldo fictício (%s)", async () => {
    const order = await createOrder();
    getPayment.mockResolvedValue(payment(order.id, "approved"));
    await Promise.all([
      processMercadoPagoPayment(`race-${order.id}`, null, "payment.updated"),
      expirePendingOrders(order.expiresAt!),
    ]);
    const saved = await database.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.paymentStatus).toBe("PAID");
    expect(["COMMITTED", "REQUIRES_REVIEW"]).toContain(saved.inventoryStatus);
    expect(await stock()).toBe(saved.inventoryStatus === "COMMITTED" ? 0 : 1);
    expect(await eventCount(order.id, "PAYMENT_CONFIRMED")).toBe(1);
    expect(await eventCount(order.id, "ORDER_CANCELLED")).toBeLessThanOrEqual(1);
  });

  it.each(["cancelled", "rejected", "pending"])("não regride aprovação concorrente com %s", async (oldStatus) => {
    const order = await createOrder();
    getPayment.mockResolvedValueOnce(payment(order.id, "approved"))
      .mockResolvedValueOnce(payment(order.id, oldStatus));
    await Promise.all([
      processMercadoPagoPayment(`race-${order.id}`, null, "payment.updated"),
      processMercadoPagoPayment(`race-${order.id}`, null, "payment.updated"),
    ]);
    const saved = await database.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.paymentStatus).toBe("PAID");
    expect(["COMMITTED", "REQUIRES_REVIEW"]).toContain(saved.inventoryStatus);
    expect(await stock()).toBe(saved.inventoryStatus === "COMMITTED" ? 0 : 1);
    expect(await eventCount(order.id, "PAYMENT_CONFIRMED")).toBe(1);
  });

  it("pagamento depois da liberação exige revisão sem reservar novamente", async () => {
    const order = await createOrder();
    await expirePendingOrders(order.expiresAt!);
    getPayment.mockResolvedValue(payment(order.id, "approved"));
    expect(await processMercadoPagoPayment(`late-${order.id}`, null, "payment.updated"))
      .toMatchObject({ result: "APPLIED_REQUIRES_INVENTORY_REVIEW" });
    expect(await stock()).toBe(1);
    expect(await database.order.findUniqueOrThrow({ where: { id: order.id } }))
      .toMatchObject({ paymentStatus: "PAID", inventoryStatus: "REQUIRES_REVIEW" });
  });

  it("estorno após confirmação não repõe estoque físico nem duplica e-mail", async () => {
    const order = await createOrder();
    const paymentId = `refund-${order.id}`;
    getPayment.mockResolvedValue(payment(order.id, "approved"));
    await processMercadoPagoPayment(paymentId, null, "payment.updated");
    getPayment.mockResolvedValue(payment(order.id, "refunded"));
    await Promise.all([
      processMercadoPagoPayment(paymentId, null, "payment.updated"),
      processMercadoPagoPayment(paymentId, null, "payment.updated"),
    ]);
    expect(await stock()).toBe(0);
    expect(await database.order.findUniqueOrThrow({ where: { id: order.id } }))
      .toMatchObject({ paymentStatus: "REFUNDED", inventoryStatus: "COMMITTED" });
    expect(await eventCount(order.id, "PAYMENT_REFUNDED")).toBe(1);
  });

  it("estorno recebido antes da aprovação libera somente a reserva não confirmada", async () => {
    const order = await createOrder();
    getPayment.mockResolvedValue(payment(order.id, "refunded"));
    await processMercadoPagoPayment(`refund-${order.id}`, null, "payment.updated");
    await expirePendingOrders(order.expiresAt!);
    expect(await stock()).toBe(1);
    expect(await database.order.findUniqueOrThrow({ where: { id: order.id } }))
      .toMatchObject({ paymentStatus: "REFUNDED", inventoryStatus: "RELEASED" });
  });

  it("estorno de outra tentativa não desfaz o pagamento confirmado", async () => {
    const order = await createOrder();
    getPayment.mockResolvedValue(payment(order.id, "approved"));
    await processMercadoPagoPayment(`paid-${order.id}`, null, "payment.updated");
    getPayment.mockResolvedValue(payment(order.id, "refunded"));
    expect(await processMercadoPagoPayment(`other-${order.id}`, null, "payment.updated"))
      .toMatchObject({ result: "IGNORED_STALE" });
    expect(await database.order.findUniqueOrThrow({ where: { id: order.id } }))
      .toMatchObject({ paymentStatus: "PAID", inventoryStatus: "COMMITTED" });
    expect(await stock()).toBe(0);
    expect(await eventCount(order.id, "PAYMENT_REFUNDED")).toBe(0);
  });

  it("job e cancelamento usam a mesma chave durável de e-mail", async () => {
    const order = await createOrder();
    getPayment.mockResolvedValue(payment(order.id, "cancelled"));
    await Promise.all([
      expirePendingOrders(order.expiresAt!),
      processMercadoPagoPayment(`cancel-${order.id}`, null, "payment.updated"),
    ]);
    expect(await stock()).toBe(1);
    expect(await eventCount(order.id, "ORDER_CANCELLED")).toBe(1);
  });

  it("falha na outbox desfaz toda a transição e permite reprocessar o evento", async () => {
    const order = await createOrder();
    const paymentId = `retry-${order.id}`;
    getPayment.mockResolvedValue(payment(order.id, "approved"));
    // Inject a real database write failure after the order update, not a mocked transaction.
    await database.$executeRaw`ALTER TABLE "EmailOutbox" ADD CONSTRAINT "integration_fail_confirmed" CHECK ("type" <> 'PAYMENT_CONFIRMED')`;
    try {
      await expect(processMercadoPagoPayment(paymentId, null, "payment.updated")).rejects.toThrow();
      expect(await database.order.findUniqueOrThrow({ where: { id: order.id } }))
        .toMatchObject({ paymentStatus: "WAITING_PAYMENT", inventoryStatus: "RESERVED" });
      expect(await database.paymentEvent.count({ where: { providerEventId: paymentId } })).toBe(0);
      expect(await eventCount(order.id, "PAYMENT_CONFIRMED")).toBe(0);
      expect(await stock()).toBe(0);
    } finally {
      await database.$executeRaw`ALTER TABLE "EmailOutbox" DROP CONSTRAINT "integration_fail_confirmed"`;
    }
    expect(await processMercadoPagoPayment(paymentId, null, "payment.updated"))
      .toMatchObject({ result: "APPLIED" });
    expect(await eventCount(order.id, "PAYMENT_CONFIRMED")).toBe(1);
  });

  it("salvar ficha antiga não restaura saldo reservado nem troca o modo de estoque", async () => {
    await database.product.update({ where: { id: productId }, data: { stockQuantity: 10 } });
    await createOrder(2);
    const form = new FormData();
    Object.entries({ productId, name: "Ficha atualizada", slug: "produto", basePrice: "15.00", stockQuantity: "10", hasVariants: "on", isActive: "on" })
      .forEach(([key, value]) => form.set(key, value));
    await expect(updateProduct(form)).rejects.toThrow("REDIRECT:");
    expect(await database.product.findUniqueOrThrow({ where: { id: productId } }))
      .toMatchObject({ name: "Ficha atualizada", stockQuantity: 8, hasVariants: false });
  });

  it("STAFF não cria variante nem modifica ficha por chamada direta", async () => {
    await database.user.update({ where: { id: actor.userId }, data: { role: "STAFF" } });
    const form = new FormData();
    Object.entries({ productId, name: "Preço adulterado", price: "0.01", basePrice: "0.01", stockQuantity: "999", isActive: "on" })
      .forEach(([key, value]) => form.set(key, value));
    await expect(saveVariant(form)).rejects.toThrow("FORBIDDEN");
    await expect(updateProduct(form)).rejects.toThrow("FORBIDDEN");
    expect(await database.productVariant.count({ where: { productId } })).toBe(0);
    expect(await database.product.findUniqueOrThrow({ where: { id: productId } }))
      .toMatchObject({ basePriceCents: 1500, name: "Produto de teste" });
  });

  it("edição de variante preserva o saldo após uma reserva", async () => {
    await database.product.update({ where: { id: productId }, data: { hasVariants: true } });
    const variant = await database.productVariant.create({ data: { productId, name: "Original", stockQuantity: 10 } });
    await createPendingOrder({ storeSlug, items: [{ productId, variantId: variant.id, quantity: 2 }],
      customer: { name: "Cliente sintético", phone: customerPhone }, deliveryMethod: "LOCAL_PICKUP" });
    const form = new FormData();
    Object.entries({ productId, variantId: variant.id, name: "Nome atualizado", stockQuantity: "10", isActive: "on" })
      .forEach(([key, value]) => form.set(key, value));
    await expect(saveVariant(form)).rejects.toThrow("REDIRECT:");
    expect(await database.productVariant.findUniqueOrThrow({ where: { id: variant.id } }))
      .toMatchObject({ name: "Nome atualizado", stockQuantity: 8 });
  });

  it("STAFF ajusta saldo com ator/motivo e replay não duplica entrada", async () => {
    await database.user.update({ where: { id: actor.userId }, data: { role: "STAFF" } });
    const input = { productId, variantId: null, expectedQuantity: 1, delta: 4, reason: "Entrada conferida", requestId: randomUUID() };
    const results = await Promise.all([adjustAvailableStock(actor, input), adjustAvailableStock(actor, input)]);
    expect(results[0].id).toBe(results[1].id);
    expect(await stock()).toBe(5);
    expect(await database.stockAdjustment.findMany({ where: { storeId } }))
      .toMatchObject([{ actorId: actor.userId, reason: "Entrada conferida", quantityBefore: 1, quantityAfter: 5, delta: 4 }]);
  });

  it("ajuste baseado em saldo antigo falha após reserva e não registra alteração", async () => {
    await database.product.update({ where: { id: productId }, data: { stockQuantity: 10 } });
    await createOrder(2);
    await expect(adjustAvailableStock(actor, { productId, variantId: null, expectedQuantity: 10,
      delta: -1, reason: "Conferência física", requestId: randomUUID() })).rejects.toThrow("STOCK_CONFLICT");
    expect(await stock()).toBe(8);
    expect(await database.stockAdjustment.count({ where: { storeId } })).toBe(0);
    const form = new FormData();
    Object.entries({ productId, expectedQuantity: "10", delta: "-1", reason: "Conferência física", requestId: randomUUID() })
      .forEach(([key, value]) => form.set(key, value));
    expect(await adjustStock({}, form)).toMatchObject({ error: expect.stringContaining("O saldo mudou") });
  });

  it("ajuste simultâneo com checkout preserva saldo e registra somente sucesso", async () => {
    const results = await Promise.allSettled([
      createOrder(),
      adjustAvailableStock(actor, { productId, variantId: null, expectedQuantity: 1, delta: 2,
        reason: "Reposição conferida", requestId: randomUUID() }),
    ]);
    expect(results[0].status).toBe("fulfilled");
    expect(await stock()).toBe(results[1].status === "fulfilled" ? 2 : 0);
    expect(await database.stockAdjustment.count({ where: { storeId } })).toBe(results[1].status === "fulfilled" ? 1 : 0);
  });

  it("bloqueia saldo negativo, mudança de intenção em replay e ator de outra loja", async () => {
    const input = { productId, variantId: null, expectedQuantity: 1, delta: -2, reason: "Saída conferida", requestId: randomUUID() };
    await expect(adjustAvailableStock(actor, input)).rejects.toThrow("INVALID_STOCK");
    await expect(adjustAvailableStock({ ...actor, storeId: "other-store" }, { ...input, delta: 1 })).rejects.toThrow("FORBIDDEN");
    await adjustAvailableStock(actor, { ...input, delta: 1 });
    await expect(adjustAvailableStock(actor, { ...input, delta: 2 })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    expect(await stock()).toBe(2);
  });

  it.each(["WAITING_PAYMENT", "FAILED", "REFUNDED"] as const)("não prepara pedido %s por chamada direta", async (paymentStatus) => {
    const order = await createOrder();
    await database.order.update({ where: { id: order.id }, data: { paymentStatus } });
    await expect(saveOrderOperation(actor, { orderId: order.id, fulfillmentStatus: "PREPARING", internalNote: "" }))
      .rejects.toThrow("ORDER_NOT_READY");
    expect(await database.order.findUniqueOrThrow({ where: { id: order.id } }))
      .toMatchObject({ fulfillmentStatus: "NOT_FULFILLED" });
  });

  it("pedido pago com estoque em revisão não pode avançar", async () => {
    const order = await createOrder();
    await database.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID", inventoryStatus: "REQUIRES_REVIEW" } });
    await expect(saveOrderOperation(actor, { orderId: order.id, fulfillmentStatus: "PREPARING", internalNote: "" }))
      .rejects.toThrow("ORDER_NOT_READY");
  });

  it("retirada paga segue preparação → retirada → entrega e recusa envio", async () => {
    const order = await createOrder();
    getPayment.mockResolvedValue(payment(order.id, "approved"));
    await processMercadoPagoPayment(`fulfillment-${order.id}`, null, "payment.updated");
    await saveOrderOperation(actor, { orderId: order.id, fulfillmentStatus: "PREPARING", internalNote: "" });
    await expect(saveOrderOperation(actor, { orderId: order.id, fulfillmentStatus: "SHIPPED", internalNote: "" }))
      .rejects.toThrow("ORDER_NOT_READY");
    await saveOrderOperation(actor, { orderId: order.id, fulfillmentStatus: "READY_FOR_PICKUP", internalNote: "" });
    await saveOrderOperation(actor, { orderId: order.id, fulfillmentStatus: "DELIVERED", internalNote: "" });
    expect(await database.order.findUniqueOrThrow({ where: { id: order.id } }))
      .toMatchObject({ fulfillmentStatus: "DELIVERED", paymentStatus: "PAID", inventoryStatus: "COMMITTED" });
  });

  it("cancelamento operacional não inventa reembolso e usuário suspenso não opera", async () => {
    const order = await createOrder();
    getPayment.mockResolvedValue(payment(order.id, "approved"));
    await processMercadoPagoPayment(`cancel-operation-${order.id}`, null, "payment.updated");
    await saveOrderOperation(actor, { orderId: order.id, fulfillmentStatus: "CANCELLED", internalNote: "Cliente pediu contato para reembolso" });
    expect(await database.order.findUniqueOrThrow({ where: { id: order.id } }))
      .toMatchObject({ fulfillmentStatus: "CANCELLED", paymentStatus: "PAID", refundedAt: null });
    await database.user.update({ where: { id: actor.userId }, data: { isActive: false } });
    await expect(saveOrderOperation(actor, { orderId: order.id, fulfillmentStatus: "CANCELLED", internalNote: "" }))
      .rejects.toThrow("FORBIDDEN");
  });

  async function latePaidReview() {
    const order = await createOrder();
    await expirePendingOrders(order.expiresAt!);
    getPayment.mockResolvedValue(payment(order.id, "approved"));
    await processMercadoPagoPayment(`late-review-${order.id}`, null, "payment.updated");
    return database.order.findUniqueOrThrow({ where: { id: order.id } });
  }
  function resolution(order: { id: string; operationVersion: number }, action = "COMMIT_STOCK") {
    return { orderId: order.id, requestId: randomUUID(), expectedVersion: order.operationVersion, action, reason: "Estoque físico conferido pelo administrador" };
  }

  it("resolve pagamento tardio com débito único, auditoria e replay concorrente idempotente", async () => {
    const order = await latePaidReview();
    const input = resolution(order);
    const results = await Promise.all([resolveOrderInventory(actor, input), resolveOrderInventory(actor, input)]);
    expect(results[0].id).toBe(results[1].id);
    expect(await stock()).toBe(0);
    expect(await database.orderInventoryResolution.findMany({ where: { orderId: order.id } })).toMatchObject([
      { actorId: actor.userId, storeId, action: "COMMIT_STOCK", reason: input.reason, previousVersion: order.operationVersion },
    ]);
    expect(await database.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      inventoryStatus: "COMMITTED", paymentStatus: "PAID", totalCents: order.totalCents,
      mercadoPagoPaymentId: order.mercadoPagoPaymentId, operationVersion: order.operationVersion + 1,
    });
    await saveOrderOperation(actor, { orderId: order.id, fulfillmentStatus: "PREPARING", internalNote: "" });
    await expect(resolveOrderInventory(actor, { ...input, action: "CANCEL_FULFILLMENT" })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });

  it("somente um pedido em revisão conquista a última unidade concorrente", async () => {
    const first = await latePaidReview();
    const second = await latePaidReview();
    const results = await Promise.allSettled([resolveOrderInventory(actor, resolution(first)), resolveOrderInventory(actor, resolution(second))]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await stock()).toBe(0);
    expect(await database.orderInventoryResolution.count({ where: { storeId } })).toBe(1);
    expect(await database.order.count({ where: { storeId, inventoryStatus: "REQUIRES_REVIEW" } })).toBe(1);
  });

  it("falta de uma variante desfaz também o débito dos outros itens", async () => {
    const order = await latePaidReview();
    const other = await database.product.create({ data: { id: `zz-${randomUUID()}`, storeId, name: "Variante sem reposição", slug: "variante", basePriceCents: 1000, hasVariants: true } });
    const variant = await database.productVariant.create({ data: { productId: other.id, name: "Única", stockQuantity: 0 } });
    await database.orderItem.create({ data: { orderId: order.id, productId: other.id, variantId: variant.id, productName: other.name, quantity: 1, unitPriceCents: 1000, totalCents: 1000 } });
    await expect(resolveOrderInventory(actor, resolution(order))).rejects.toThrow("INSUFFICIENT_STOCK");
    expect(await stock()).toBe(1);
    expect(await database.orderInventoryResolution.count({ where: { orderId: order.id } })).toBe(0);
    expect(await database.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ operationVersion: order.operationVersion, inventoryStatus: "REQUIRES_REVIEW" });
  });

  it("nega STAFF, ator suspenso, loja alheia e cancelamento de revisão por operação comum", async () => {
    const order = await latePaidReview();
    await database.user.update({ where: { id: actor.userId }, data: { role: "STAFF" } });
    await expect(resolveOrderInventory(actor, resolution(order))).rejects.toThrow("FORBIDDEN");
    const form = new FormData();
    Object.entries({ ...resolution(order), resolution: "COMMIT_STOCK" }).forEach(([key, value]) => form.set(key, String(value)));
    expect(await resolveInventoryReview({}, form)).toMatchObject({ error: expect.stringContaining("Somente o proprietário") });
    await expect(saveOrderOperation(actor, { orderId: order.id, fulfillmentStatus: "CANCELLED", internalNote: "" })).rejects.toThrow("ORDER_NOT_READY");
    await database.user.update({ where: { id: actor.userId }, data: { role: "ADMIN", isActive: false } });
    await expect(resolveOrderInventory(actor, resolution(order))).rejects.toThrow("FORBIDDEN");
    await database.user.update({ where: { id: actor.userId }, data: { isActive: true } });
    await expect(resolveOrderInventory({ ...actor, storeId: "other-store" }, resolution(order))).rejects.toThrow("FORBIDDEN");
    const other = await database.store.create({ data: { name: "Outra loja sintética", slug: `review-other-${randomUUID()}` } });
    try {
      const operator = await database.user.create({ data: { storeId: other.id, name: "Outro administrador", email: `${other.id}@example.test`, role: "ADMIN" } });
      await expect(resolveOrderInventory({ userId: operator.id, storeId: other.id }, resolution(order))).rejects.toThrow("ORDER_NOT_FOUND");
    } finally { await database.store.delete({ where: { id: other.id } }); }
    expect(await stock()).toBe(1);
  });

  it("cancelamento auditado mantém pagamento e valores, sem repor saldo nem inventar estorno", async () => {
    const order = await latePaidReview();
    const input = resolution(order, "CANCEL_FULFILLMENT");
    await Promise.all([resolveOrderInventory(actor, input), resolveOrderInventory(actor, input)]);
    expect(await stock()).toBe(1);
    expect(await database.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      fulfillmentStatus: "CANCELLED", inventoryStatus: "RELEASED", paymentStatus: "PAID", refundedAt: null,
      totalCents: order.totalCents, mercadoPagoPaymentId: order.mercadoPagoPaymentId,
    });
    await expect(saveOrderOperation(actor, { orderId: order.id, fulfillmentStatus: "PREPARING", internalNote: "" })).rejects.toThrow("ORDER_NOT_READY");
    getPayment.mockResolvedValue(payment(order.id, "refunded"));
    await processMercadoPagoPayment(order.mercadoPagoPaymentId!, null, "payment.updated");
    expect(await database.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ paymentStatus: "REFUNDED", fulfillmentStatus: "CANCELLED", inventoryStatus: "RELEASED" });
    expect(await stock()).toBe(1);
  });

  it("decisões opostas concorrentes e formulário antigo não se sobrepõem", async () => {
    const order = await latePaidReview();
    const results = await Promise.allSettled([resolveOrderInventory(actor, resolution(order)), resolveOrderInventory(actor, resolution(order, "CANCEL_FULFILLMENT"))]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await database.orderInventoryResolution.count({ where: { orderId: order.id } })).toBe(1);
    const saved = await database.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(await stock()).toBe(saved.inventoryStatus === "COMMITTED" ? 0 : 1);
    await expect(resolveOrderInventory(actor, resolution(order))).rejects.toThrow("ORDER_CHANGED");
  });

  it("reembolso concorrente serializa com revisão sem liberar estoque comprometido silenciosamente", async () => {
    const order = await latePaidReview();
    getPayment.mockResolvedValue(payment(order.id, "refunded"));
    const results = await Promise.allSettled([
      processMercadoPagoPayment(order.mercadoPagoPaymentId!, null, "payment.updated"),
      resolveOrderInventory(actor, resolution(order)),
    ]);
    expect(results[0].status).toBe("fulfilled");
    const saved = await database.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.paymentStatus).toBe("REFUNDED");
    expect(saved.inventoryStatus).toBe(results[1].status === "fulfilled" ? "COMMITTED" : "RELEASED");
    expect(await stock()).toBe(results[1].status === "fulfilled" ? 0 : 1);
    await expect(saveOrderOperation(actor, { orderId: order.id, fulfillmentStatus: "PREPARING", internalNote: "" })).rejects.toThrow("ORDER_NOT_READY");
  });

  it("entrega paga segue preparação → envio → entrega e recusa retirada", async () => {
    const order = await createOrder();
    await database.order.update({ where: { id: order.id }, data: { deliveryMethod: "LOCAL_DELIVERY" } });
    getPayment.mockResolvedValue(payment(order.id, "approved"));
    await processMercadoPagoPayment(`delivery-${order.id}`, null, "payment.updated");
    await saveOrderOperation(actor, { orderId: order.id, fulfillmentStatus: "PREPARING", internalNote: "" });
    await expect(saveOrderOperation(actor, { orderId: order.id, fulfillmentStatus: "READY_FOR_PICKUP", internalNote: "" }))
      .rejects.toThrow("ORDER_NOT_READY");
    await saveOrderOperation(actor, { orderId: order.id, fulfillmentStatus: "SHIPPED", internalNote: "" });
    await saveOrderOperation(actor, { orderId: order.id, fulfillmentStatus: "DELIVERED", internalNote: "" });
    expect(await database.order.findUniqueOrThrow({ where: { id: order.id } }))
      .toMatchObject({ fulfillmentStatus: "DELIVERED", paymentStatus: "PAID" });
  });
});
