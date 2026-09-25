import type { Metadata } from "next";
import { CartPage } from "../../../storefront/cart/cart-page";
import { getRequestStoreSlug } from "../../../lib/store-context";

export const metadata: Metadata = { title: "Carrinho", robots: { index: false, follow: false } };

export default async function CartRoute() {
  return <section className="cart-page"><div className="store-container"><CartPage storeSlug={await getRequestStoreSlug()} /></div></section>;
}
