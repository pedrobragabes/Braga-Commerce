import { createHash } from "node:crypto";
export function syntheticPaymentAccount(storeId: string, overrides: Record<string, unknown> = {}) {
  return { key: `fixture-${storeId}`, storeId, collectorId: String(parseInt(createHash("sha256").update(storeId).digest("hex").slice(0, 10), 16)),
    environment: "sandbox", accessToken: `synthetic-token-${storeId}`, webhookSecret: `synthetic-secret-${storeId}`, newCheckouts: true, ...overrides };
}
export function configureSyntheticPayments(accounts: ReturnType<typeof syntheticPaymentAccount>[], legacyKey?: string) {
  process.env.MERCADO_PAGO_ACCOUNTS_JSON = JSON.stringify({ version: 1, accounts });
  if (legacyKey) process.env.MERCADO_PAGO_LEGACY_ACCOUNT_KEY = legacyKey;
  else delete process.env.MERCADO_PAGO_LEGACY_ACCOUNT_KEY;
}
