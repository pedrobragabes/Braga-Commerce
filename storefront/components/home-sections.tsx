import Link from "next/link";
import type { StorefrontCategory, StorefrontConfig, StorefrontProduct, StorefrontStore } from "../types";
import { StoreIcon } from "./icons";
import { ProductArtwork } from "./product-artwork";
import { ProductCard } from "./product-card";

export function StoreHero({ config }: { config: StorefrontConfig }) {
  return (
    <section className="hero-section">
      <div className="store-container hero-grid">
        <div className="hero-copy">
          <p className="section-eyebrow">{config.hero.eyebrow}</p>
          <h1>{config.hero.title}</h1>
          <p>{config.hero.description}</p>
          <div className="hero-actions">
            <Link className="primary-button" href="/produtos">{config.hero.primaryCta}<StoreIcon name="arrow" /></Link>
            <a className="text-button" href="#sobre">{config.hero.secondaryCta}</a>
          </div>
        </div>
        <div className="hero-editorial" aria-label="Editorial PV Moda">
          <span className="hero-badge">{config.hero.badge}</span>
          <div className="editorial-number">01</div>
          <div className="editorial-look look-one"><ProductArtwork categorySlug="camisas" label="Camisa PV Moda" /></div>
          <div className="editorial-look look-two"><ProductArtwork categorySlug="calcas" label="Calça PV Moda" /></div>
          <p>Essenciais<br />bem escolhidos.</p>
        </div>
      </div>
    </section>
  );
}
export function BenefitStrip({ config }: { config: StorefrontConfig }) {
  return (
    <section aria-label="Diferenciais da loja" className="benefit-strip">
      <div className="store-container benefit-grid">
        {config.benefits.map((benefit) => (
          <article key={benefit.title}>
            <span className="benefit-icon"><StoreIcon name={benefit.icon} size={28} /></span>
            <div><h2>{benefit.title}</h2><p>{benefit.description}</p></div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function CategorySection({ categories }: { categories: StorefrontCategory[] }) {
  return (
    <section className="store-section category-section">
      <div className="store-container">
        <div className="section-heading">
          <div><p className="section-eyebrow">Encontre seu estilo</p><h2>Escolha por categoria</h2></div>
          <Link href="/produtos">Ver tudo <StoreIcon name="arrow" size={18} /></Link>
        </div>
        <div className="category-grid">
          {categories.map((category, index) => (
            <Link className="category-card" data-index={index + 1} href={`/categoria/${category.slug}`} key={category.id}>
              <ProductArtwork categorySlug={category.slug} imageUrl={category.imageUrl} label={category.name} compact />
              <span className="category-number">0{index + 1}</span>
              <div><h3>{category.name}</h3><p>{category.productCount} {category.productCount === 1 ? "produto" : "produtos"}</p></div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeaturedSection({ products }: { products: StorefrontProduct[] }) {
  return (
    <section className="store-section featured-section">
      <div className="store-container">
        <div className="section-heading light">
          <div><p className="section-eyebrow">Seleção PV</p><h2>Destaques da vitrine</h2></div>
          <Link href="/produtos">Ver coleção <StoreIcon name="arrow" size={18} /></Link>
        </div>
        <div className="product-grid">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </div>
    </section>
  );
}

export function StoreStory({ config, store }: { config: StorefrontConfig; store: StorefrontStore }) {
  return (
    <section className="story-section" id="sobre">
      <div className="store-container story-grid">
        <div className="story-stamp"><span>PV</span><small>Moda<br />Masculina</small></div>
        <div>
          <p className="section-eyebrow">{config.story.eyebrow}</p>
          <h2>{config.story.title}</h2>
        </div>
        <div>
          <p>{config.story.description}</p>
          <a className="text-button" href="#contato">Falar com {store.name}</a>
        </div>
      </div>
    </section>
  );
}
