import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client";
import { getDatabase } from "../database";
import { MercadoPagoIntegrationError } from "./errors";

const key = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const accountSchema = z.object({
  key, storeId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/), collectorId: z.string().regex(/^[1-9][0-9]{0,23}$/),
  environment: z.enum(["sandbox", "production"]), accessToken: z.string().trim().min(16).max(4096).regex(/^[\x21-\x7E]+$/),
  webhookSecret: z.string().trim().min(16).max(4096).regex(/^[\x21-\x7E]+$/), newCheckouts: z.boolean(),
}).strict();
const configSchema = z.object({ version: z.literal(1), accounts: z.array(accountSchema).min(1).max(100) }).strict();
export type PaymentAccount = Readonly<z.infer<typeof accountSchema>>;
function fail(code: string, message = "Pagamento desta loja ainda não foi configurado."): never { throw new MercadoPagoIntegrationError(message, code, 503); }

export function configuredPaymentAccounts(env: Record<string, string | undefined> = process.env): ReadonlyArray<PaymentAccount> {
  const raw = env.MERCADO_PAGO_ACCOUNTS_JSON;
  if (!raw) fail("PAYMENT_NOT_CONFIGURED");
  try {
    if (raw.length > 262_144) throw new Error();
    const { accounts } = configSchema.parse(JSON.parse(raw));
    const keys = new Set<string>(), activeStores = new Set<string>(), collectors = new Map<string, string>(), tokens = new Map<string, string>();
    for (const account of accounts) {
      if (keys.has(account.key) || (account.newCheckouts && activeStores.has(account.storeId))
        || (collectors.has(account.collectorId) && collectors.get(account.collectorId) !== account.storeId)
        || (tokens.has(account.accessToken) && tokens.get(account.accessToken) !== account.storeId)) throw new Error();
      keys.add(account.key); if (account.newCheckouts) activeStores.add(account.storeId); collectors.set(account.collectorId, account.storeId);
      tokens.set(account.accessToken, account.storeId);
    }
    if (env.MERCADO_PAGO_LEGACY_ACCOUNT_KEY && !accounts.some((account) => account.key === env.MERCADO_PAGO_LEGACY_ACCOUNT_KEY)) throw new Error();
    return Object.freeze(accounts.map((account) => Object.freeze(account)));
  } catch { fail("PAYMENT_CONFIG_INVALID", "Configuração de pagamento inválida. Contate a operação da plataforma."); }
}

export function paymentAccountByKey(accountKey?: string): PaymentAccount {
  const selected = accountKey ?? process.env.MERCADO_PAGO_LEGACY_ACCOUNT_KEY;
  if (!selected || !key.safeParse(selected).success) fail("PAYMENT_ACCOUNT_REQUIRED");
  const account = configuredPaymentAccounts().find((account) => account.key === selected);
  if (!account) fail("PAYMENT_ACCOUNT_NOT_CONFIGURED");
  return account;
}
export function paymentAccountForStore(storeId: string): PaymentAccount {
  const account = configuredPaymentAccounts().find((account) => account.storeId === storeId && account.newCheckouts);
  if (!account) fail("PAYMENT_NOT_CONFIGURED");
  return account;
}
export function isLegacyPaymentAccount(account: PaymentAccount) { return account.key === process.env.MERCADO_PAGO_LEGACY_ACCOUNT_KEY; }

export async function assertPaymentAccountBinding(transaction: Prisma.TransactionClient, account: PaymentAccount) {
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`payment-collector:${account.collectorId}`}, 0))`;
  if (await transaction.paymentAccountBinding.findFirst({ where: { collectorId: account.collectorId, storeId: { not: account.storeId } }, select: { key: true } })) fail("PAYMENT_COLLECTOR_ALREADY_BOUND");
  await transaction.paymentAccountBinding.createMany({ skipDuplicates: true, data: {
    key: account.key, storeId: account.storeId, collectorId: account.collectorId, environment: account.environment,
  } });
  const bound = await transaction.paymentAccountBinding.findUniqueOrThrow({ where: { key: account.key } });
  if (bound.storeId !== account.storeId || bound.collectorId !== account.collectorId || bound.environment !== account.environment) fail("PAYMENT_ACCOUNT_IDENTITY_CHANGED", "A identidade da conta de pagamento mudou. Restaure a configuração original e use uma nova chave para outra conta.");
}

// Used before any preference request. The account identity is durable across
// retries, credential rotation, store renaming and provider/network failures.
export async function bindOrderPaymentAccount(orderId: string) {
  return getDatabase().$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await transaction.order.findUnique({ where: { id: orderId } });
    if (!order) throw new MercadoPagoIntegrationError("Pedido não encontrado.", "ORDER_NOT_FOUND", 404);
    const account = order.paymentAccountKey ? paymentAccountByKey(order.paymentAccountKey)
      : order.paymentLegacy ? paymentAccountByKey() : paymentAccountForStore(order.storeId);
    if (account.storeId !== order.storeId) fail("PAYMENT_STORE_MISMATCH");
    await assertPaymentAccountBinding(transaction, account);
    if (order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED" || order.fulfillmentStatus === "CANCELLED") throw new MercadoPagoIntegrationError("Este pedido não aceita um novo pagamento.", "ORDER_NOT_PAYABLE", 409);
    if (order.inventoryStatus !== "RESERVED" || !order.expiresAt || order.expiresAt <= new Date()) throw new MercadoPagoIntegrationError("A reserva deste pedido expirou.", "ORDER_EXPIRED", 409);
    if (!order.paymentAccountKey) {
      if (!account.newCheckouts && !order.mercadoPagoPreferenceId) fail("PAYMENT_NOT_CONFIGURED");
      await transaction.order.update({ where: { id: order.id }, data: { paymentAccountKey: account.key } });
    }
    if (!account.newCheckouts && !order.mercadoPagoPreferenceId) fail("PAYMENT_NOT_CONFIGURED");
    return account;
  });
}
