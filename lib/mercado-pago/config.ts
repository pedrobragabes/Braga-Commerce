import { MercadoPagoConfig } from "mercadopago";
import { paymentAccountByKey, type PaymentAccount } from "./accounts";
import { MercadoPagoIntegrationError } from "./errors";
export { MercadoPagoIntegrationError } from "./errors";

export { getPublicAppUrl } from "../app-url";

export type MercadoPagoEnvironment = "sandbox" | "production";

export function getMercadoPagoEnvironment(): MercadoPagoEnvironment {
  const environment = process.env.MERCADO_PAGO_ENV ?? "sandbox";
  if (environment !== "sandbox" && environment !== "production") {
    throw new MercadoPagoIntegrationError(
      "MERCADO_PAGO_ENV deve ser sandbox ou production.",
      "INVALID_PAYMENT_ENVIRONMENT",
    );
  }
  return environment;
}

export function getMercadoPagoClient(account: PaymentAccount = paymentAccountByKey()) {
  return new MercadoPagoConfig({ accessToken: account.accessToken, options: { timeout: 8_000 } });
}

export function getMercadoPagoWebhookSecret(accountKey?: string) {
  return paymentAccountByKey(accountKey).webhookSecret;
}

export function assertMercadoPagoCheckoutUrl(rawUrl: string | undefined) {
  if (!rawUrl) {
    throw new MercadoPagoIntegrationError(
      "O provedor não retornou uma URL de pagamento.",
      "CHECKOUT_URL_MISSING",
      502,
    );
  }

  const url = new URL(rawUrl);
  const allowedHost = url.hostname === "mercadopago.com"
    || url.hostname.endsWith(".mercadopago.com")
    || url.hostname === "mercadopago.com.br"
    || url.hostname.endsWith(".mercadopago.com.br");
  if (url.protocol !== "https:" || !allowedHost || url.username || url.password) {
    throw new MercadoPagoIntegrationError(
      "O provedor retornou uma URL de pagamento inválida.",
      "UNSAFE_CHECKOUT_URL",
      502,
    );
  }
  return url.toString();
}
