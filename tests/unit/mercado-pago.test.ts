import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertMercadoPagoCheckoutUrl,
  getMercadoPagoEnvironment,
  MercadoPagoIntegrationError,
} from "../../lib/mercado-pago/config";
import {
  buildPaymentEventKey,
  mapMercadoPagoStatus,
  shouldApplyPaymentTransition,
} from "../../lib/mercado-pago/status";
import { validateMercadoPagoWebhookSignature } from "../../lib/mercado-pago/webhook";

const originalEnvironment = process.env.MERCADO_PAGO_ENV;
const originalWebhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

afterEach(() => {
  if (originalEnvironment === undefined) delete process.env.MERCADO_PAGO_ENV;
  else process.env.MERCADO_PAGO_ENV = originalEnvironment;
  if (originalWebhookSecret === undefined) delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  else process.env.MERCADO_PAGO_WEBHOOK_SECRET = originalWebhookSecret;
});

describe("Mercado Pago configuration", () => {
  it("defaults to sandbox and rejects invalid environments", () => {
    delete process.env.MERCADO_PAGO_ENV;
    expect(getMercadoPagoEnvironment()).toBe("sandbox");
    process.env.MERCADO_PAGO_ENV = "preview";
    expect(() => getMercadoPagoEnvironment()).toThrow(MercadoPagoIntegrationError);
  });

  it("only accepts HTTPS checkout URLs owned by Mercado Pago", () => {
    expect(assertMercadoPagoCheckoutUrl("https://sandbox.mercadopago.com.br/checkout/v1/redirect"))
      .toContain("mercadopago.com.br");
    expect(() => assertMercadoPagoCheckoutUrl("https://mercadopago.com.br.evil.test/checkout"))
      .toThrow("inválida");
    expect(() => assertMercadoPagoCheckoutUrl("http://mercadopago.com.br/checkout"))
      .toThrow("inválida");
  });
});

describe("Mercado Pago status transitions", () => {
  it.each([
    ["approved", "PAID", "CONFIRMED"],
    ["pending", "WAITING_PAYMENT", "PENDING"],
    ["in_process", "WAITING_PAYMENT", "PENDING"],
    ["rejected", "FAILED", "PENDING"],
    ["cancelled", "CANCELLED", "CANCELLED"],
    ["refunded", "REFUNDED", "REFUNDED"],
    ["charged_back", "REFUNDED", "REFUNDED"],
  ])("maps %s", (providerStatus, paymentStatus, orderStatus) => {
    expect(mapMercadoPagoStatus(providerStatus)).toEqual({ paymentStatus, orderStatus });
  });

  it("does not let stale events undo paid or refunded orders", () => {
    expect(shouldApplyPaymentTransition("PAID", "WAITING_PAYMENT", true)).toBe(false);
    expect(shouldApplyPaymentTransition("PAID", "REFUNDED", true)).toBe(true);
    expect(shouldApplyPaymentTransition("REFUNDED", "PAID", true)).toBe(false);
    expect(shouldApplyPaymentTransition("FAILED", "WAITING_PAYMENT", true)).toBe(false);
  });

  it("creates a stable key for provider state idempotency", () => {
    expect(buildPaymentEventKey("123", "approved")).toBe("mercadopago:123:approved");
  });
});

describe("Mercado Pago webhook signature", () => {
  it("accepts the official manifest signature and rejects tampering", () => {
    const secret = "test-webhook-secret";
    const dataId = "123456";
    const requestId = "request-abc";
    const timestamp = 1_720_000_000_000;
    const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
    const signature = createHmac("sha256", secret).update(manifest).digest("hex");
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = secret;

    expect(() => validateMercadoPagoWebhookSignature({
      signature: `ts=${timestamp},v1=${signature}`,
      requestId,
      dataId,
      now: () => timestamp,
    })).not.toThrow();

    expect(() => validateMercadoPagoWebhookSignature({
      signature: `ts=${timestamp},v1=invalid`,
      requestId,
      dataId,
      now: () => timestamp,
    })).toThrow();
  });
});
