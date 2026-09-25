import { afterEach, describe, expect, it, vi } from "vitest";
import { configuredPaymentAccounts, paymentAccountByKey, paymentAccountForStore } from "../../lib/mercado-pago/accounts";
const fixture = { key: "store-a-v1", storeId: "store-a", collectorId: "101", environment: "sandbox", accessToken: "synthetic-token-a", webhookSecret: "synthetic-secret-a", newCheckouts: true };
afterEach(() => vi.unstubAllEnvs());
describe("configuração explícita de recebedores", () => {
  it("tokens globais não habilitam contas ou endpoint legado implicitamente", () => {
    vi.stubEnv("MERCADO_PAGO_ACCOUNTS_JSON", ""); vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "synthetic-old-token");
    expect(() => paymentAccountForStore("store-a")).toThrow();
    vi.stubEnv("MERCADO_PAGO_ACCOUNTS_JSON", JSON.stringify({ version: 1, accounts: [fixture] }));
    vi.stubEnv("MERCADO_PAGO_LEGACY_ACCOUNT_KEY", "");
    expect(() => paymentAccountByKey()).toThrow();
    expect(paymentAccountByKey(fixture.key).storeId).toBe(fixture.storeId);
  });
  it.each([
    [fixture, fixture], [fixture, { ...fixture, key: "second" }],
    [fixture, { ...fixture, key: "second", storeId: "store-b" }],
    [{ ...fixture, collectorId: "0" }], [{ ...fixture, extraSecret: "synthetic-hidden" }],
  ])("recusa configuração ambígua ou inválida sem incluir segredo na exceção", (...accounts) => {
    expect(() => configuredPaymentAccounts({ MERCADO_PAGO_ACCOUNTS_JSON: JSON.stringify({ version: 1, accounts }) })).toThrow("Configuração de pagamento inválida");
  });
  it("conta sem novas compras continua selecionável para eventos, sem fallback por loja", () => {
    vi.stubEnv("MERCADO_PAGO_ACCOUNTS_JSON", JSON.stringify({ version: 1, accounts: [{ ...fixture, newCheckouts: false }] }));
    vi.stubEnv("MERCADO_PAGO_LEGACY_ACCOUNT_KEY", fixture.key);
    expect(paymentAccountByKey().key).toBe(fixture.key);
    expect(() => paymentAccountForStore(fixture.storeId)).toThrow();
    expect(() => paymentAccountByKey("missing")).toThrow();
  });
});
