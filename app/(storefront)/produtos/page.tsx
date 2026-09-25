import type { Metadata } from "next";
import { ProductCard } from "../../../storefront/components/product-card";
import { getRequestStoreSlug } from "../../../lib/store-context";
import { getCatalogProducts } from "../../../storefront/data";

export const metadata: Metadata = {
  title: "Produtos",
  description: "Confira os produtos e suas informações atualizadas.",
  alternates: { canonical: "/produtos" },
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const products = await getCatalogProducts(await getRequestStoreSlug(), { query: q });

  return (
    <section className="catalog-page">
      <div className="store-container">
        <div className="catalog-heading">
          <p className="section-eyebrow">Catálogo da loja</p>
          <h1>{q ? `Resultados para “${q}”` : "Todos os produtos"}</h1>
          <p>{products.length} {products.length === 1 ? "peça encontrada" : "peças encontradas"}</p>
        </div>
        {products.length ? (
          <div className="product-grid catalog-grid">
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <div className="empty-state">
            <span aria-hidden="true">+</span>
            <h2>Nenhum produto encontrado.</h2>
            <p>Tente outro termo ou navegue pelas categorias no menu.</p>
          </div>
        )}
      </div>
    </section>
  );
}
