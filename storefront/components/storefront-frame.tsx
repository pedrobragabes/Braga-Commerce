import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { CartProvider } from "../cart/cart-context";
import { CartLink } from "../cart/cart-link";
import { normalizeWhatsapp } from "../format";
import type { StorefrontCategory, StorefrontConfig, StorefrontStore } from "../types";
import { StoreIcon } from "./icons";

function themeVariables(config: StorefrontConfig) {
  return {
    "--store-ink": config.theme.ink,
    "--store-paper": config.theme.paper,
    "--store-surface": config.theme.surface,
    "--store-accent": config.theme.accent,
    "--store-accent-strong": config.theme.accentStrong,
    "--store-brand": config.theme.brand,
    "--store-brand-soft": config.theme.brandSoft,
    "--store-line": config.theme.line,
    "--store-muted": config.theme.muted,
    "--store-radius": config.theme.radius,
  } as CSSProperties;
}

function StoreHeader({
  store,
  categories,
  config,
}: {
  store: StorefrontStore;
  categories: StorefrontCategory[];
  config: StorefrontConfig;
}) {
  const whatsapp = normalizeWhatsapp(store.whatsapp);
  const location = [store.city, store.state].filter(Boolean).join(" · ");

  return (
    <header className="store-header">
      <div className="announcement-bar">
        <div className="store-container announcement-inner">
          <p>{config.announcement}</p>
          <div>
            {location ? <span><StoreIcon name="pin" size={15} />{location}</span> : null}
            {whatsapp ? <a href={`https://wa.me/${whatsapp}`} rel="noreferrer" target="_blank"><StoreIcon name="whatsapp" size={15} />WhatsApp</a> : null}
          </div>
        </div>
      </div>
      <div className="store-container header-main">
        <Link className="brand-lockup" href="/" aria-label={`${store.name}, início`}>
          <span className="brand-mark">PV</span>
          <span><strong>{store.name}</strong><small>{config.brandKicker}</small></span>
        </Link>
        <form action="/produtos" className="search-form" role="search">
          <StoreIcon name="search" />
          <input aria-label="Pesquisar produtos" name="q" placeholder="Pesquisar camisetas, camisas, calças..." type="search" />
          <button type="submit">Buscar</button>
        </form>
        <div className="header-actions">
          <a className="service-link" href="#contato">
            <StoreIcon name="user" />
            <span><small>Precisa de ajuda?</small><strong>Fale com a loja</strong></span>
          </a>
          <CartLink />
        </div>
      </div>
      <nav aria-label="Navegação principal" className="category-nav">
        <div className="store-container nav-inner">
          <Link href="/">Início</Link>
          <Link href="/produtos">Todos os produtos</Link>
          {categories.map((category) => (
            <Link href={`/categoria/${category.slug}`} key={category.id}>{category.name}</Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

function StoreFooter({ store }: { store: StorefrontStore }) {
  const whatsapp = normalizeWhatsapp(store.whatsapp);
  const address = [store.address, store.city, store.state].filter(Boolean).join(" · ");

  return (
    <footer className="store-footer" id="contato">
      <div className="store-container footer-grid">
        <div className="footer-brand">
          <span className="brand-mark inverse">PV</span>
          <h2>{store.name}</h2>
          <p>Moda masculina com curadoria local e atendimento próximo.</p>
        </div>
        <div>
          <h3>Explore</h3>
          <Link href="/">Início</Link>
          <Link href="/produtos">Produtos</Link>
          <a href="#sobre">Sobre a loja</a>
        </div>
        <div>
          <h3>Atendimento</h3>
          {whatsapp ? <a href={`https://wa.me/${whatsapp}`} rel="noreferrer" target="_blank">Conversar no WhatsApp</a> : <span>WhatsApp em configuração</span>}
          {store.email ? <a href={`mailto:${store.email}`}>{store.email}</a> : null}
          {address ? <span>{address}</span> : <span>Consulte retirada e entrega com a loja</span>}
        </div>
        <div>
          <h3>Compra consciente</h3>
          <p>Confirme tamanho, cor e disponibilidade antes de finalizar seu atendimento.</p>
          <Link href="/trocas">Trocas e devoluções</Link>
          <Link href="/privacidade">Privacidade</Link>
        </div>
      </div>
      <div className="store-container footer-bottom">
        <span>© {new Date().getFullYear()} {store.name}</span>
        <span>Loja piloto · Braga Commerce</span>
      </div>
      {whatsapp ? (
        <a aria-label="Conversar no WhatsApp" className="floating-whatsapp" href={`https://wa.me/${whatsapp}`} rel="noreferrer" target="_blank">
          <StoreIcon name="whatsapp" size={25} />
        </a>
      ) : null}
    </footer>
  );
}

export function StorefrontFrame({
  store,
  categories,
  config,
  children,
}: {
  store: StorefrontStore;
  categories: StorefrontCategory[];
  config: StorefrontConfig;
  children: ReactNode;
}) {
  return (
    <CartProvider storeSlug={store.slug}>
      <div className="storefront" style={themeVariables(config)}>
        <StoreHeader categories={categories} config={config} store={store} />
        <main>{children}</main>
        <StoreFooter store={store} />
      </div>
    </CartProvider>
  );
}
