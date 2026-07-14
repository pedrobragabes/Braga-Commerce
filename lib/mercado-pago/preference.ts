import { Preference } from "mercadopago";
import { getDatabase } from "../database";
import { logEvent } from "../observability/logger";
import {
  assertMercadoPagoCheckoutUrl,
  getMercadoPagoClient,
  getMercadoPagoEnvironment,
  getPublicAppUrl,
  MercadoPagoIntegrationError,
} from "./config";

function selectCheckoutUrl(response: { init_point?: string; sandbox_init_point?: string }) {
  const environment = getMercadoPagoEnvironment();
  const rawUrl = environment === "sandbox" ? response.sandbox_init_point : response.init_point;
  return { checkoutUrl: assertMercadoPagoCheckoutUrl(rawUrl), environment };
}

export async function createOrderPreference(orderId: string) {
  const database = getDatabase();
  const order = await database.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
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
  if (order.paymentStatus === "PAID" || order.status === "REFUNDED") {
    throw new MercadoPagoIntegrationError("Este pedido não aceita um novo pagamento.", "ORDER_NOT_PAYABLE", 409);
  }
  if (order.inventoryStatus !== "RESERVED" || !order.expiresAt || order.expiresAt <= new Date()) {
    throw new MercadoPagoIntegrationError("A reserva deste pedido expirou.", "ORDER_EXPIRED", 409);
  }

  const preferenceClient = new Preference(getMercadoPagoClient());
  if (order.mercadoPagoPreferenceId) {
    const existingPreference = await preferenceClient.get({ preferenceId: order.mercadoPagoPreferenceId });
    return { preferenceId: order.mercadoPagoPreferenceId, ...selectCheckoutUrl(existingPreference) };
  }

  const appUrl = getPublicAppUrl();
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
      metadata: { order_id: order.id, expected_total_cents: order.totalCents },
      back_urls: {
        success: `${orderUrl}?payment=success`,
        pending: `${orderUrl}?payment=pending`,
        failure: `${orderUrl}?payment=failure`,
      },
      auto_return: "approved",
      notification_url: `${appUrl}/api/webhooks/mercadopago?source_news=webhooks`,
      statement_descriptor: "PV MODA",
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: order.expiresAt.toISOString(),
    },
    requestOptions: { idempotencyKey: `preference-${order.id}` },
  });

  if (!preference.id) {
    throw new MercadoPagoIntegrationError(
      "O provedor não identificou a preferência criada.",
      "PREFERENCE_ID_MISSING",
      502,
    );
  }

  const checkout = selectCheckoutUrl(preference);
  await database.order.update({
    where: { id: order.id },
    data: { mercadoPagoPreferenceId: preference.id },
  });

  logEvent("info", "mercado_pago.preference.created", {
    orderId: order.id,
    preferenceId: preference.id,
    environment: checkout.environment,
  });

  return { preferenceId: preference.id, ...checkout };
}
