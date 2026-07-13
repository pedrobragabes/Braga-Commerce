import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "../../../../storefront/components/product-gallery";
import { VariationPicker } from "../../../../storefront/components/variation-picker";
import { pvModaConfig } from "../../../../storefront/config/pv-moda";
import { getProductBySlug, getStoreNavigation } from "../../../../storefront/data";
import { formatCurrency } from "../../../../storefront/format";

type ProductPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(pvModaConfig.storeSlug, slug);
  return { title: product?.name ?? "Produto", description: product?.shortDescription ?? undefined };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const [product, navigation] = await Promise.all([
    getProductBySlug(pvModaConfig.storeSlug, slug),
    getStoreNavigation(pvModaConfig.storeSlug),
  ]);

  if (!product || !navigation) notFound();

  return (
    <section className="product-page">
      <div className="store-container">
        <nav aria-label="Navegação estrutural" className="breadcrumbs">
          <Link href="/">Início</Link><span>/</span>
          <Link href="/produtos">Produtos</Link><span>/</span>
          {product.category ? <><Link href={`/categoria/${product.category.slug}`}>{product.category.name}</Link><span>/</span></> : null}
          <span>{product.name}</span>
        </nav>
        <div className="product-detail-grid">
          <ProductGallery
            categorySlug={product.category?.slug}
            images={product.images}
            onSale={Boolean(product.compareAtCents)}
            productName={product.name}
          />
          <div className="product-detail-copy">
            <p className="section-eyebrow">{product.category?.name ?? "PV Moda"}</p>
            <h1>{product.name}</h1>
            <p className="product-detail-summary">{product.shortDescription}</p>
            <div className="base-price">
              {product.compareAtCents ? <del>{formatCurrency(product.compareAtCents)}</del> : null}
              <strong>{formatCurrency(product.basePriceCents)}</strong>
              <small>Consulte condições diretamente com a loja.</small>
            </div>
            <VariationPicker
              basePriceCents={product.basePriceCents}
              productId={product.id}
              productName={product.name}
              variants={product.variants}
              whatsapp={navigation.store.whatsapp}
            />
            <div className="product-description">
              <h2>Sobre a peça</h2>
              <p>{product.description}</p>
              <ul><li>Informação de estoque por variação</li><li>Atendimento local e pessoal</li><li>Confirmação de tamanho antes do pedido</li></ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
