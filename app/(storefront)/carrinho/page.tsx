import type { Metadata } from "next";
import { CartPage } from "../../../storefront/cart/cart-page";
import { pvModaConfig } from "../../../storefront/config/pv-moda";

export const metadata: Metadata = { title: "Carrinho" };

export default function CartRoute() {
  return <section className="cart-page"><div className="store-container"><CartPage storeSlug={pvModaConfig.storeSlug} /></div></section>;
}
