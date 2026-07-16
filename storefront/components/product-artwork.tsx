function FashionShape({ categorySlug }: { categorySlug: string }) {
  if (categorySlug === "calcas") {
    return <path d="M67 28h66l-5 56-13 80H91L80 87l-13 77H43l13-80 11-56Z" />;
  }

  if (categorySlug === "bermudas") {
    return <path d="M57 40h86l-7 49-25 39-11-32-11 32-25-39-7-49Z" />;
  }

  if (categorySlug === "acessorios") {
    return (
      <>
        <circle cx="95" cy="98" r="53" fill="none" stroke="currentColor" strokeWidth="15" />
        <path d="m138 57 27 4-3 25-28-4Z" />
      </>
    );
  }

  const isShirt = categorySlug === "camisas";
  return (
    <>
      <path d="m68 36 32 16 32-16 35 24-20 35-15-9v78H68V86l-15 9-20-35 35-24Z" />
      {isShirt ? (
        <>
          <path d="m84 44 16 18 16-18" fill="none" stroke="var(--store-paper)" strokeWidth="5" />
          <path d="M100 63v91" fill="none" stroke="var(--store-paper)" strokeWidth="3" />
        </>
      ) : null}
    </>
  );
}

const artworkDirections: Record<string, { edition: string; kicker: string; caption: string }> = {
  camisetas: {
    edition: "01 / ESSENTIALS",
    kicker: "Cotidiano essencial",
    caption: "Forma leve · corte preciso",
  },
  camisas: {
    edition: "02 / TAILORING",
    kicker: "Alfaiataria casual",
    caption: "Linhas limpas · presença natural",
  },
  polos: {
    edition: "03 / HERITAGE",
    kicker: "Clássico renovado",
    caption: "Textura sutil · atitude serena",
  },
  calcas: {
    edition: "04 / STRUCTURE",
    kicker: "Base contemporânea",
    caption: "Proporção moderna · movimento livre",
  },
  bermudas: {
    edition: "05 / WEEKEND",
    kicker: "Ritmo descontraído",
    caption: "Conforto urbano · dias ao ar livre",
  },
  acessorios: {
    edition: "06 / DETAILS",
    kicker: "O detalhe completa",
    caption: "Acabamento marcante · uso diário",
  },
};

const defaultArtworkDirection = {
  edition: "PV / MENSWEAR",
  kicker: "Curadoria masculina",
  caption: "Estilo contemporâneo · Braga",
};

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
        className={
          compact
            ? "product-artwork product-artwork-image has-image is-compact"
            : "product-artwork product-artwork-image has-image"
        }
        data-artwork="image"
        role="img"
        style={{ backgroundImage: `url(${JSON.stringify(imageUrl)})` }}
      />
    );
  }

  const direction = artworkDirections[categorySlug] ?? defaultArtworkDirection;

  return (
    <div
      aria-label={`Representação editorial de ${label}`}
      className={
        compact ? "product-artwork artwork-fallback is-compact" : "product-artwork artwork-fallback"
      }
      data-artwork="fallback"
      data-category={categorySlug}
      role="img"
    >
      <div aria-hidden="true" className="artwork-grid" />
      <div aria-hidden="true" className="artwork-header">
        <span className="artwork-monogram">PV / MODA</span>
        <span className="artwork-edition">{direction.edition}</span>
      </div>
      <svg aria-hidden="true" className="artwork-shape" viewBox="0 0 200 200">
        <FashionShape categorySlug={categorySlug} />
      </svg>
      <div aria-hidden="true" className="artwork-copy">
        <span className="artwork-kicker">{direction.kicker}</span>
        <strong className="artwork-title">{label}</strong>
      </div>
      <span aria-hidden="true" className="artwork-caption">
        {direction.caption}
      </span>
    </div>
  );
}
