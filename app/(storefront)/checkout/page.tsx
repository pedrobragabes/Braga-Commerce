import type { Metadata } from "next";
import { getCheckoutSettings } from "../../../lib/cart-quote";
import { CheckoutForm } from "../../../storefront/checkout/checkout-form";
import { pvModaConfig } from "../../../storefront/config/pv-moda";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutRoute() {
  const settings = await getCheckoutSettings(pvModaConfig.storeSlug);
  return <section className="checkout-page"><div className="store-container"><CheckoutForm settings={settings} storeSlug={pvModaConfig.storeSlug} /></div></section>;
}
