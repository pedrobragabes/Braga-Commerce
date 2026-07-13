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

  return (
    <div className="product-gallery">
      <div className="product-gallery-main">
        {onSale ? <span className="sale-flag large">Oferta especial</span> : null}
        <ProductArtwork
          categorySlug={categorySlug}
          imageUrl={selectedImage?.url}
          label={selectedImage?.alt ?? productName}
        />
      </div>
      {images.length > 1 ? (
        <div aria-label="Galeria do produto" className="gallery-thumbnails">
          {images.map((image, index) => (
            <button
              aria-label={`Ver imagem ${index + 1} de ${productName}`}
              aria-pressed={selectedIndex === index}
              key={`${image.url}-${index}`}
              onClick={() => setSelectedIndex(index)}
              type="button"
            >
              <ProductArtwork categorySlug={categorySlug} imageUrl={image.url} label={image.alt ?? productName} compact />
            </button>
          ))}
        </div>
      ) : null}
      <p>As ilustrações serão substituídas pelas fotos reais da PV Moda no milestone de upload.</p>
    </div>
  );
}
