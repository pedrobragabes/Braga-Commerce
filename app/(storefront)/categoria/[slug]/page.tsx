import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "../../../../storefront/components/product-card";
import { pvModaConfig } from "../../../../storefront/config/pv-moda";
import { getCatalogProducts, getStoreNavigation } from "../../../../storefront/data";

type CategoryPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const navigation = await getStoreNavigation(pvModaConfig.storeSlug);
  const category = navigation?.categories.find((item) => item.slug === slug);
  return {
    title: category?.name ?? "Categoria",
    description:
      category?.description ?? `Confira a seleção de ${category?.name ?? "produtos"} da PV Moda.`,
    alternates: { canonical: `/categoria/${slug}` },
  };
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
          <p>
            {category.description ??
              `${products.length} ${products.length === 1 ? "peça selecionada" : "peças selecionadas"} pela PV Moda.`}
          </p>
        </div>
        {products.length ? (
          <div className="product-grid catalog-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <section aria-labelledby="empty-category-title" className="empty-state storefront-state">
            <span aria-hidden="true" className="storefront-state__mark">
              PV
            </span>
            <p className="section-eyebrow">Novidades a caminho</p>
            <h2 id="empty-category-title">Esta seleção está sendo renovada.</h2>
            <p>
              Ainda não há peças disponíveis em {category.name}. Enquanto preparamos as próximas
              entradas, descubra o restante da coleção.
            </p>
            <div className="storefront-state__actions">
              <Link className="primary-button storefront-state__button" href="/produtos">
                Ver coleção completa
              </Link>
              <Link className="secondary-button storefront-state__button" href="/">
                Descobrir destaques
              </Link>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
