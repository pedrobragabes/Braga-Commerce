import { MercadoPagoConfig } from "mercadopago";

export class MercadoPagoIntegrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 500,
  ) {
    super(message);
  }
}

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

export function getMercadoPagoClient() {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new MercadoPagoIntegrationError(
      "Pagamento online ainda não foi configurado.",
      "PAYMENT_NOT_CONFIGURED",
      503,
    );
  }

  return new MercadoPagoConfig({ accessToken, options: { timeout: 8_000 } });
}

export function getMercadoPagoWebhookSecret() {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) {
    throw new MercadoPagoIntegrationError(
      "Assinatura do webhook ainda não foi configurada.",
      "WEBHOOK_NOT_CONFIGURED",
      503,
    );
  }
  return secret;
}

export function getPublicAppUrl() {
  const explicitUrl = process.env.NEXT_PUBLIC_APP_URL;
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const rawUrl = explicitUrl || (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000");
  const url = new URL(rawUrl);
  return url.origin;
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
  if (url.protocol !== "https:" || !allowedHost) {
    throw new MercadoPagoIntegrationError(
      "O provedor retornou uma URL de pagamento inválida.",
      "UNSAFE_CHECKOUT_URL",
      502,
    );
  }
  return url.toString();
}
