const SKELETON_CARDS = Array.from({ length: 6 }, (_, index) => index);

export default function StorefrontLoading() {
  return (
    <section aria-busy="true" className="catalog-page storefront-skeleton">
      <div aria-label="Carregando a vitrine da PV Moda" className="store-container" role="status">
        <header aria-hidden="true" className="storefront-skeleton__header">
          <span className="storefront-skeleton__eyebrow" />
          <span className="storefront-skeleton__title" />
          <span className="storefront-skeleton__copy" />
        </header>

        <ul aria-hidden="true" className="product-grid catalog-grid storefront-skeleton__grid">
          {SKELETON_CARDS.map((card) => (
            <li className="storefront-skeleton__card" key={card}>
              <article>
                <div className="storefront-skeleton__media" />
                <div>
                  <span className="storefront-skeleton__line" />
                  <span className="storefront-skeleton__line" />
                  <span className="storefront-skeleton__line" />
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
