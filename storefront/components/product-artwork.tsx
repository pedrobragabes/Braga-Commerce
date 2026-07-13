function FashionShape({ categorySlug }: { categorySlug: string }) {
  if (categorySlug === "calcas") {
    return <path d="M67 28h66l-5 56-13 80H91L80 87l-13 77H43l13-80 11-56Z" />;
  }

  if (categorySlug === "bermudas") {
    return <path d="M57 40h86l-7 49-25 39-11-32-11 32-25-39-7-49Z" />;
  }

  if (categorySlug === "acessorios") {
    return <><circle cx="95" cy="98" r="53" fill="none" stroke="currentColor" strokeWidth="15" /><path d="m138 57 27 4-3 25-28-4Z" /></>;
  }

  const isShirt = categorySlug === "camisas";
  return (
    <>
      <path d="m68 36 32 16 32-16 35 24-20 35-15-9v78H68V86l-15 9-20-35 35-24Z" />
      {isShirt ? <><path d="m84 44 16 18 16-18" fill="none" stroke="var(--store-paper)" strokeWidth="5" /><path d="M100 63v91" fill="none" stroke="var(--store-paper)" strokeWidth="3" /></> : null}
    </>
  );
}
export function ProductArtwork({
  categorySlug = "camisetas",
  imageUrl,
  label,
  compact = false,
}: {
  categorySlug?: string;
  imageUrl?: string | null;
  label: string;
  compact?: boolean;
}) {
  if (imageUrl) {
    return (
      <div
        aria-label={label}
        className={`product-artwork has-image${compact ? " is-compact" : ""}`}
        role="img"
        style={{ backgroundImage: `url(${JSON.stringify(imageUrl)})` }}
      />
    );
  }

  return (
    <div
      aria-label={`Ilustração temporária de ${label}`}
      className={`product-artwork${compact ? " is-compact" : ""}`}
      data-category={categorySlug}
      role="img"
    >
      <span className="artwork-monogram">PV</span>
      <svg aria-hidden="true" viewBox="0 0 200 200">
        <FashionShape categorySlug={categorySlug} />
      </svg>
      <span className="artwork-caption">Imagem em preparação</span>
    </div>
  );
}
