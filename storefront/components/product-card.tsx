import Link from "next/link";
import { formatCurrency } from "../format";
import type { StorefrontProduct } from "../types";
import { StoreIcon } from "./icons";
import { ProductArtwork } from "./product-artwork";

export function ProductCard({ product }: { product: StorefrontProduct }) {
  return (
    <article className="product-card">
      <Link aria-label={`Ver ${product.name}`} className="product-card-visual" href={`/produto/${product.slug}`}>
        {product.compareAtCents ? <span className="sale-flag">Oferta</span> : null}
        <ProductArtwork
          categorySlug={product.category?.slug}
          imageUrl={product.images[0]?.url}
          label={product.name}
          compact
        />
      </Link>
      <div className="product-card-copy">
        <p className="product-category">{product.category?.name ?? "PV Moda"}</p>
        <h3><Link href={`/produto/${product.slug}`}>{product.name}</Link></h3>
        <p className="product-summary">{product.shortDescription}</p>
        <div className="price-row">
          <div>
            {product.compareAtCents ? <del>{formatCurrency(product.compareAtCents)}</del> : null}
            <strong>{formatCurrency(product.basePriceCents)}</strong>
          </div>
          <span className={product.available ? "stock available" : "stock"}>
            {product.available ? "Disponível" : "Indisponível"}
          </span>
        </div>
        <Link className="product-link" href={`/produto/${product.slug}`}>
          Ver detalhes <StoreIcon name="arrow" size={18} />
        </Link>
      </div>
    </article>
  );
}
