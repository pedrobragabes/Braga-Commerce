"use client";

import { useState } from "react";
import { ProductArtwork } from "./product-artwork";

export function ProductGallery({
  productName,
  categorySlug,
  images,
  onSale,
}: {
  productName: string;
  categorySlug?: string;
  images: ReadonlyArray<{ url: string; alt: string | null }>;
  onSale: boolean;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedImage = images[selectedIndex];
  const selectedLabel = selectedImage?.alt ?? productName;

  return (
    <section aria-label={`Imagens de ${productName}`} className="product-gallery">
      <figure className="product-gallery-main">
        <div className="gallery-stage">
          {onSale ? <span className="sale-flag large">Oferta especial</span> : null}
          <ProductArtwork
            categorySlug={categorySlug}
            imageUrl={selectedImage?.url}
            label={selectedLabel}
          />
        </div>
        <figcaption aria-live="polite" className="gallery-caption">
          <span className="gallery-caption-copy">
            <strong className="gallery-caption-label">{selectedLabel}</strong>
            <small className="gallery-caption-meta">
              {images.length ? "Vista selecionada" : "Edição visual da coleção"}
            </small>
          </span>
          <span
            aria-label={
              images.length
                ? `Imagem ${selectedIndex + 1} de ${images.length}`
                : "Arte editorial do produto"
            }
            className="gallery-counter"
          >
            {images.length
              ? `${String(selectedIndex + 1).padStart(2, "0")} / ${String(images.length).padStart(2, "0")}`
              : "PV / 01"}
          </span>
        </figcaption>
      </figure>
      {images.length > 1 ? (
        <div
          aria-label={`Escolher imagem de ${productName}`}
          className="gallery-thumbnails"
          role="group"
        >
          {images.map((image, index) => (
            <button
              aria-label={`Ver imagem ${index + 1} de ${images.length}: ${image.alt ?? productName}`}
              aria-pressed={selectedIndex === index}
              className="gallery-thumbnail"
              data-selected={selectedIndex === index ? "true" : "false"}
              key={`${image.url}-${index}`}
              onClick={() => setSelectedIndex(index)}
              type="button"
            >
              <ProductArtwork
                categorySlug={categorySlug}
                imageUrl={image.url}
                label={image.alt ?? productName}
                compact
              />
              <span aria-hidden="true" className="gallery-thumbnail-meta">
                <span className="gallery-thumbnail-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <small>{selectedIndex === index ? "Em foco" : "Vista"}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
