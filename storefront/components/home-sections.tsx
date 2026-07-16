import Link from "next/link";
import { formatCurrency } from "../format";
import type {
  StorefrontCategory,
  StorefrontConfig,
  StorefrontProduct,
  StorefrontStore,
} from "../types";
import { StoreIcon } from "./icons";
import { ProductArtwork } from "./product-artwork";
import { ProductCard } from "./product-card";

function HeroProduct({
  product,
  className,
  index,
}: {
  product: StorefrontProduct | undefined;
  className: string;
  index: string;
}) {
  const artwork = (
    <>
      <ProductArtwork
        categorySlug={product?.category?.slug}
        imageUrl={product?.images[0]?.url}
        label={product?.name ?? "Seleção PV Moda"}
      />
      <span className="hero-media-index">{index}</span>
      <span className="hero-media-copy">
        <small>{product?.category?.name ?? "Curadoria PV"}</small>
        <strong>{product?.name ?? "Essenciais bem escolhidos"}</strong>
        {product ? <b>{formatCurrency(product.basePriceCents)}</b> : null}
      </span>
    </>
  );

  if (!product) return <div className={`hero-media ${className}`}>{artwork}</div>;

  return (
    <Link
      aria-label={`Conhecer ${product.name}`}
      className={`hero-media ${className}`}
      href={`/produto/${product.slug}`}
    >
      {artwork}
    </Link>
  );
}

export function StoreHero({
  config,
  products,
}: {
  config: StorefrontConfig;
  products: StorefrontProduct[];
}) {
  return (
    <section className="hero-section">
      <div className="store-container hero-grid">
        <div className="hero-copy">
          <p className="section-eyebrow">{config.hero.eyebrow}</p>
          <h1>{config.hero.title}</h1>
          <p>{config.hero.description}</p>
          <div className="hero-actions">
            <Link className="primary-button" href="/produtos">
              {config.hero.primaryCta}
              <StoreIcon name="arrow" />
            </Link>
            <a className="text-button" href="#sobre">
              {config.hero.secondaryCta}
            </a>
          </div>
          <div className="hero-meta" aria-label="Diferenciais da coleção">
            <span>
              <strong>01</strong> Curadoria local
            </span>
            <span>
              <strong>02</strong> Estoque por tamanho
            </span>
          </div>
        </div>
        <div className="hero-editorial" aria-label="Seleção editorial PV Moda">
          <span className="hero-badge">{config.hero.badge}</span>
          <HeroProduct className="hero-media-lead" index="01" product={products[0]} />
          <HeroProduct className="hero-media-detail" index="02" product={products[1]} />
          <span aria-hidden="true" className="hero-signature">
            PV / 26
          </span>
          <div className="hero-note">
            <span>Seleção da semana</span>
            <p>Texturas, cortes e cores para usar mais de uma vez.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
export function BenefitStrip({ config }: { config: StorefrontConfig }) {
  return (
    <section aria-label="Diferenciais da loja" className="benefit-strip">
      <div className="store-container benefit-grid">
        {config.benefits.map((benefit, index) => (
          <article key={benefit.title}>
            <span className="benefit-number">0{index + 1}</span>
            <span className="benefit-icon">
              <StoreIcon name={benefit.icon} size={28} />
            </span>
            <div>
              <h2>{benefit.title}</h2>
              <p>{benefit.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function CategorySection({ categories }: { categories: StorefrontCategory[] }) {
  if (!categories.length) {
    return (
      <section className="store-section category-section">
        <div className="store-container">
          <div className="storefront-state">
            <span aria-hidden="true" className="storefront-state__mark">
              PV
            </span>
            <p className="section-eyebrow">Coleção em movimento</p>
            <h2>Novas categorias estão sendo preparadas.</h2>
            <p>
              Enquanto a curadoria é atualizada, fale com a loja para conhecer as peças disponíveis.
            </p>
            <div className="storefront-state__actions">
              <a className="primary-button" href="#contato">
                Falar com a loja
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="store-section category-section">
      <div className="store-container">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">Navegue pela coleção</p>
            <h2>Um ponto de partida para cada ocasião.</h2>
          </div>
          <Link href="/produtos">
            Ver tudo <StoreIcon name="arrow" size={18} />
          </Link>
        </div>
        <div className="category-grid">
          {categories.map((category, index) => (
            <Link
              className="category-card"
              data-index={index + 1}
              href={`/categoria/${category.slug}`}
              key={category.id}
            >
              <div className="category-card-media">
                <ProductArtwork
                  categorySlug={category.slug}
                  imageUrl={category.imageUrl}
                  label={category.name}
                  compact
                />
              </div>
              <span className="category-number">0{index + 1}</span>
              <div className="category-card-copy">
                <h3>{category.name}</h3>
                <p>
                  {category.productCount} {category.productCount === 1 ? "produto" : "produtos"}
                </p>
                <StoreIcon name="arrow" size={20} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeaturedSection({ products }: { products: StorefrontProduct[] }) {
  if (!products.length) {
    return (
      <section className="store-section featured-section">
        <div className="store-container">
          <div className="storefront-state featured-empty">
            <span aria-hidden="true" className="storefront-state__mark">
              PV
            </span>
            <p className="section-eyebrow">Próxima seleção</p>
            <h2>Os destaques da vitrine estão sendo renovados.</h2>
            <p>Explore a coleção completa ou converse com a loja sobre as novidades.</p>
            <div className="storefront-state__actions">
              <Link className="primary-button" href="/produtos">
                Ver coleção completa
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="store-section featured-section">
      <div className="store-container">
        <div className="section-heading light">
          <div>
            <p className="section-eyebrow">Escolhas da PV</p>
            <h2>Peças para usar agora — e depois.</h2>
          </div>
          <Link href="/produtos">
            Ver coleção <StoreIcon name="arrow" size={18} />
          </Link>
        </div>
        <div className="product-grid featured-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function StoreStory({
  config,
  store,
}: {
  config: StorefrontConfig;
  store: StorefrontStore;
}) {
  return (
    <section className="story-section" id="sobre">
      <div className="store-container story-grid">
        <div className="story-stamp">
          <span>PV</span>
          <small>
            {store.city ?? "Moda"}
            <br />
            {store.state ?? "Masculina"}
          </small>
        </div>
        <div>
          <p className="section-eyebrow">{config.story.eyebrow}</p>
          <h2>{config.story.title}</h2>
        </div>
        <div>
          <span className="story-index">Manifesto / 01</span>
          <p>{config.story.description}</p>
          <a className="text-button" href="#contato">
            Falar com {store.name}
          </a>
        </div>
      </div>
    </section>
  );
}
