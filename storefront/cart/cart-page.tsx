"use client";

import Link from "next/link";
import { CommerceProgress } from "../components/commerce-progress";
import { ProductArtwork } from "../components/product-artwork";
import { StoreIcon } from "../components/icons";
import { formatCurrency } from "../format";
import { useCart } from "./cart-context";
import { useCartQuote } from "./use-cart-quote";

export function CartPage({ storeSlug }: { storeSlug: string }) {
  const { items, ready, updateQuantity, removeItem, clearCart } = useCart();
  const { quote, error, loading } = useCartQuote(storeSlug);

  if (!ready) {
    return (
      <div className="cart-loading" aria-live="polite">
        Abrindo seu carrinho…
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="cart-empty">
        <span>
          <StoreIcon name="bag" size={32} />
        </span>
        <p className="section-eyebrow">Seu carrinho</p>
        <h1>Comece por uma peça que combina com você.</h1>
        <p>Escolha tamanho e cor na página do produto. O carrinho ficará salvo neste navegador.</p>
        <Link className="primary-button" href="/produtos">
          Explorar produtos <StoreIcon name="arrow" />
        </Link>
      </div>
    );
  }

  return (
    <div className="cart-layout">
      <section className="cart-panel" aria-labelledby="cart-title">
        <CommerceProgress current={1} />
        <div className="cart-title-row">
          <div>
            <p className="section-eyebrow">Sua seleção</p>
            <h1 id="cart-title">Carrinho</h1>
          </div>
          <button className="text-button danger" onClick={clearCart} type="button">
            Limpar carrinho
          </button>
        </div>
        {error ? (
          <div className="form-alert error" role="alert">
            {error} Você pode limpar o carrinho e escolher novamente.
          </div>
        ) : null}
        {loading && !quote ? (
          <div className="cart-loading" aria-live="polite">
            Conferindo preços e estoque…
          </div>
        ) : null}
        <div className="cart-lines">
          {quote?.items.map((line) => {
            const cartItem = items.find(
              (item) => item.productId === line.productId && item.variantId === line.variantId,
            );
            if (!cartItem) return null;
            return (
              <article
                className={line.available ? "cart-line" : "cart-line unavailable"}
                key={`${line.productId}:${line.variantId ?? "simple"}`}
              >
                <Link className="cart-line-art" href={`/produto/${line.productSlug}`}>
                  <ProductArtwork
                    categorySlug={line.categorySlug ?? undefined}
                    compact
                    imageUrl={line.imageUrl ?? undefined}
                    label={line.productName}
                  />
                </Link>
                <div className="cart-line-copy">
                  <p>{line.variantName ?? "Modelo único"}</p>
                  <h2>
                    <Link href={`/produto/${line.productSlug}`}>{line.productName}</Link>
                  </h2>
                  <strong>{formatCurrency(line.unitPriceCents)}</strong>
                  {!line.available ? (
                    <span className="line-warning">Estoque insuficiente. Reduza a quantidade.</span>
                  ) : null}
                </div>
                <div className="quantity-control" aria-label={`Quantidade de ${line.productName}`}>
                  <button
                    aria-label="Diminuir quantidade"
                    disabled={cartItem.quantity <= 1}
                    onClick={() => updateQuantity(cartItem, cartItem.quantity - 1)}
                    type="button"
                  >
                    <StoreIcon name="minus" size={16} />
                  </button>
                  <span aria-live="polite">{cartItem.quantity}</span>
                  <button
                    aria-label="Aumentar quantidade"
                    disabled={
                      line.stockQuantity !== null && cartItem.quantity >= line.stockQuantity
                    }
                    onClick={() => updateQuantity(cartItem, cartItem.quantity + 1)}
                    type="button"
                  >
                    <StoreIcon name="plus" size={16} />
                  </button>
                </div>
                <div className="cart-line-total">
                  <strong>{formatCurrency(line.totalCents)}</strong>
                  <button
                    aria-label={`Remover ${line.productName}`}
                    onClick={() => removeItem(cartItem)}
                    type="button"
                  >
                    <StoreIcon name="trash" size={17} /> Remover
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <aside className="cart-summary">
        <p className="section-eyebrow">Resumo</p>
        <h2>Seu pedido</h2>
        <div className="summary-row">
          <span>Subtotal</span>
          <strong>{quote ? formatCurrency(quote.subtotalCents) : "—"}</strong>
        </div>
        <div className="summary-row muted">
          <span>Entrega</span>
          <span>Escolha no checkout</span>
        </div>
        {quote?.issues.map((issue) => (
          <p className="summary-issue" key={issue}>
            {issue}
          </p>
        ))}
        {quote && !quote.issues.length ? (
          <Link className="primary-button full" href="/checkout">
            Continuar para checkout <StoreIcon name="arrow" />
          </Link>
        ) : (
          <button className="primary-button full" disabled type="button">
            Revise o carrinho
          </button>
        )}
        <Link className="secondary-button full" href="/produtos">
          Continuar comprando
        </Link>
        <p className="summary-note">
          <StoreIcon name="shield" size={17} /> Preço e estoque serão conferidos novamente antes de
          criar o pedido.
        </p>
      </aside>
    </div>
  );
}
