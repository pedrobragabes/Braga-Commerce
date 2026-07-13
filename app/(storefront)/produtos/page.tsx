import type { Metadata } from "next";
import { ProductCard } from "../../../storefront/components/product-card";
import { pvModaConfig } from "../../../storefront/config/pv-moda";
import { getCatalogProducts } from "../../../storefront/data";

export const metadata: Metadata = {
  title: "Produtos",
  description: "Confira camisetas, camisas, polos, calças, bermudas e acessórios da PV Moda.",
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const products = await getCatalogProducts(pvModaConfig.storeSlug, { query: q });

  return (
    <section className="catalog-page">
      <div className="store-container">
        <div className="catalog-heading">
          <p className="section-eyebrow">Coleção PV Moda</p>
          <h1>{q ? `Resultados para “${q}”` : "Todos os produtos"}</h1>
          <p>{products.length} {products.length === 1 ? "peça encontrada" : "peças encontradas"}</p>
        </div>
        {products.length ? (
          <div className="product-grid catalog-grid">
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <div className="empty-state">
            <span>PV</span>
            <h2>Nenhum produto encontrado.</h2>
            <p>Tente outro termo ou navegue pelas categorias no menu.</p>
          </div>
        )}
      </div>
    </section>
  );
}
