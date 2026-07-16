"use client";

import Link from "next/link";

type StorefrontErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function StorefrontError({ reset }: StorefrontErrorProps) {
  return (
    <section className="catalog-page">
      <div className="store-container">
        <section
          aria-describedby="storefront-error-description"
          aria-labelledby="storefront-error-title"
          className="storefront-state"
          role="alert"
        >
          <span aria-hidden="true" className="storefront-state__mark">
            !
          </span>
          <p className="section-eyebrow">A vitrine fez uma pausa</p>
          <h1 id="storefront-error-title">Não conseguimos abrir esta página.</h1>
          <p id="storefront-error-description">
            Pode ser só um ajuste rápido nos bastidores. Tente carregar novamente ou volte para o
            início da coleção.
          </p>
          <div className="storefront-state__actions">
            <button
              className="primary-button storefront-state__button"
              onClick={reset}
              type="button"
            >
              Tentar novamente
            </button>
            <Link className="secondary-button storefront-state__button" href="/">
              Voltar ao início
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}
