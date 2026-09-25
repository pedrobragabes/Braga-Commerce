import { Preference } from "mercadopago";
import { getDatabase } from "../database";
import { logEvent } from "../observability/logger";
import {
  assertMercadoPagoCheckoutUrl,
  getMercadoPagoClient,
  getPublicAppUrl,
  MercadoPagoIntegrationError,
} from "./config";
import { bindOrderPaymentAccount, type PaymentAccount } from "./accounts";
import { canonicalStoreUrl } from "../directory-bridge";

function selectCheckoutUrl(response: { init_point?: string; sandbox_init_point?: string; collector_id?: number; external_reference?: string }, account: PaymentAccount, orderId: string) {
  const environment = account.environment;
  if (!Number.isSafeInteger(response.collector_id) || String(response.collector_id) !== account.collectorId || response.external_reference !== orderId) throw new MercadoPagoIntegrationError("O provedor retornou uma preferência incompatível.", "PREFERENCE_ACCOUNT_MISMATCH", 502);
  const rawUrl = environment === "sandbox" ? response.sandbox_init_point : response.init_point;
  return { checkoutUrl: assertMercadoPagoCheckoutUrl(rawUrl), environment };
}

export async function createOrderPreference(orderId: string) {
  const database = getDatabase();
  const order = await database.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      store: { select: { slug: true, name: true, domain: true } },
      status: true,
      paymentStatus: true,
      shippingCents: true,
      totalCents: true,
      customerName: true,
      customerEmail: true,
      mercadoPagoPreferenceId: true,
      inventoryStatus: true,
      expiresAt: true,
      items: { select: { id: true, productName: true, variantName: true, quantity: true, unitPriceCents: true } },
    },
  });

  if (!order) throw new MercadoPagoIntegrationError("Pedido não encontrado.", "ORDER_NOT_FOUND", 404);
  const account = await bindOrderPaymentAccount(order.id);
  if (order.paymentStatus === "PAID" || order.status === "REFUNDED") {
    throw new MercadoPagoIntegrationError("Este pedido não aceita um novo pagamento.", "ORDER_NOT_PAYABLE", 409);
  }
  if (order.inventoryStatus !== "RESERVED" || !order.expiresAt || order.expiresAt <= new Date()) {
    throw new MercadoPagoIntegrationError("A reserva deste pedido expirou.", "ORDER_EXPIRED", 409);
  }

  const preferenceClient = new Preference(getMercadoPagoClient(account));
  if (order.mercadoPagoPreferenceId) {
    const existingPreference = await preferenceClient.get({ preferenceId: order.mercadoPagoPreferenceId });
    return { preferenceId: order.mercadoPagoPreferenceId, ...selectCheckoutUrl(existingPreference, account, order.id) };
  }

  const appUrl = canonicalStoreUrl(order.store) ?? (order.store.slug === process.env.STORE_SLUG ? getPublicAppUrl() : null);
  if (!appUrl) throw new MercadoPagoIntegrationError("Configure o endereço público desta loja antes de receber pagamentos.", "STOREFRONT_NOT_CONFIGURED", 503);
  const orderUrl = `${appUrl}/pedido/${order.id}`;
  const preference = await preferenceClient.create({
    body: {
      items: [
        ...order.items.map((item) => ({
          id: item.id,
          title: item.variantName ? `${item.productName} — ${item.variantName}` : item.productName,
          quantity: item.quantity,
          currency_id: "BRL",
          unit_price: item.unitPriceCents / 100,
        })),
        ...(order.shippingCents > 0 ? [{
          id: `delivery-${order.id}`,
          title: "Entrega local",
          quantity: 1,
          currency_id: "BRL",
          unit_price: order.shippingCents / 100,
        }] : []),
      ],
      payer: {
        name: order.customerName,
        ...(order.customerEmail ? { email: order.customerEmail } : {}),
      },
      external_reference: order.id,
      metadata: { order_id: order.id, expected_total_cents: order.totalCents, account_key: account.key, store_id: account.storeId },
      back_urls: {
        success: `${orderUrl}?payment=success`,
        pending: `${orderUrl}?payment=pending`,
        failure: `${orderUrl}?payment=failure`,
      },
      auto_return: "approved",
      notification_url: `${appUrl}/api/webhooks/mercadopago?source_news=webhooks&account=${encodeURIComponent(account.key)}`,
      statement_descriptor: order.store.name.normalize("NFKD").replace(/[^A-Za-z0-9 ]/g, "").slice(0, 13) || "LOJA",
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: order.expiresAt.toISOString(),
    },
    requestOptions: { idempotencyKey: `preference-${account.key}-${order.id}` },
  });

  if (!preference.id) {
    throw new MercadoPagoIntegrationError(
      "O provedor não identificou a preferência criada.",
      "PREFERENCE_ID_MISSING",
      502,
    );
  }

  const checkout = selectCheckoutUrl(preference, account, order.id);
  const saved = await database.order.updateMany({
    where: { id: order.id, paymentAccountKey: account.key, paymentStatus: { in: ["WAITING_PAYMENT", "FAILED"] }, inventoryStatus: "RESERVED", expiresAt: { gt: new Date() }, OR: [{ mercadoPagoPreferenceId: null }, { mercadoPagoPreferenceId: preference.id }] },
    data: { mercadoPagoPreferenceId: preference.id },
  });
  if (saved.count !== 1) throw new MercadoPagoIntegrationError("O pedido mudou durante a criação do pagamento. Recarregue para conferir.", "ORDER_CHANGED", 409);

  logEvent("info", "mercado_pago.preference.created", {
    orderId: order.id,
    preferenceId: preference.id,
    environment: checkout.environment,
  });

  return { preferenceId: preference.id, ...checkout };
}
