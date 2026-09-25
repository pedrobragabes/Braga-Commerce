import type { Metadata } from "next";
import { getCheckoutSettings } from "../../../lib/cart-quote";
import { CheckoutForm } from "../../../storefront/checkout/checkout-form";
import { getRequestStoreSlug } from "../../../lib/store-context";
import { getCustomerSession } from "../../../lib/customer-auth";
import { getRequestStore } from "../../../lib/store-context";
import { canStoreReceiveOrders } from "../../../lib/store-lifecycle";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function CheckoutRoute() {
  if (!await canStoreReceiveOrders((await getRequestStore()).id)) return <section className="store-container storefront-state"><h1>Novas compras indisponíveis</h1><p>Se você já fez um pedido, continue acompanhando-o pela sua conta. Para dúvidas, fale com a loja.</p><a className="primary-button" href="#contato">Ver contato</a></section>;
  const [settings, identity] = await Promise.all([getCheckoutSettings(await getRequestStoreSlug()), getCustomerSession()]);
  return <section className="checkout-page"><div className="store-container"><CheckoutForm settings={settings} storeSlug={await getRequestStoreSlug()} identity={identity ? { name: identity.name, email: identity.email } : null} /></div></section>;
}
