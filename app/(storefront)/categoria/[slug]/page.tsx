import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard } from "../../../../storefront/components/product-card";
import { pvModaConfig } from "../../../../storefront/config/pv-moda";
import { getCatalogProducts, getStoreNavigation } from "../../../../storefront/data";

type CategoryPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const navigation = await getStoreNavigation(pvModaConfig.storeSlug);
  const category = navigation?.categories.find((item) => item.slug === slug);
  return { title: category?.name ?? "Categoria" };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const [navigation, products] = await Promise.all([
    getStoreNavigation(pvModaConfig.storeSlug),
    getCatalogProducts(pvModaConfig.storeSlug, { categorySlug: slug }),
  ]);
  const category = navigation?.categories.find((item) => item.slug === slug);

  if (!category) notFound();

  return (
    <section className="catalog-page">
      <div className="store-container">
        <div className="catalog-heading category-heading">
          <p className="section-eyebrow">Categoria</p>
          <h1>{category.name}</h1>
          <p>{category.description ?? `${products.length} ${products.length === 1 ? "peça selecionada" : "peças selecionadas"} pela PV Moda.`}</p>
        </div>
        <div className="product-grid catalog-grid">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </div>
    </section>
  );
}
