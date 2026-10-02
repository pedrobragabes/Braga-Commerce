import { describe, expect, it } from "vitest";
import { projectCatalogItem, publicCatalogImage, type CatalogProduct } from "../../lib/catalog-projection";

const item: CatalogProduct = { id: "product-1", slug: "camisa-azul", name: "Camisa azul", basePriceCents: 5000,
  stockQuantity: 3, hasVariants: false, images: [{ url: "https://images.example.test/public/item.webp" }], variants: [] };
const images = new Set(["images.example.test"]);
const origin = "https://shop.example.test";

describe("projeção pública limitada do catálogo", () => {
  it("projeta apenas campos públicos e valores inteiros em BRL", () => {
    expect(projectCatalogItem(item, origin, images)).toEqual({ id: item.id, slug: item.slug, name: item.name,
      canonicalUrl: origin + "/produto/camisa-azul", imageUrl: item.images[0].url, availability: "available",
      price: { currency: "BRL", min: 5000, max: 5000 } });
  });
  it("preço menor sem estoque ou de variante inativa não é anunciado; null usa a base", () => {
    expect(projectCatalogItem({ ...item, hasVariants: true, variants: [
      { isActive: true, stockQuantity: 0, priceCents: 100 }, { isActive: false, stockQuantity: 2, priceCents: 200 },
      { isActive: true, stockQuantity: 1, priceCents: null }, { isActive: true, stockQuantity: 2, priceCents: 6000 },
    ] }, origin, images)?.price).toEqual({ currency: "BRL", min: 5000, max: 6000 });
  });
  it.each([{ ...item, stockQuantity: 0 }, { ...item, hasVariants: true }, { ...item, hasVariants: true,
    variants: [{ isActive: true, stockQuantity: 0, priceCents: 100 }] }])("indisponibilidade remove o preço", product => {
    expect(projectCatalogItem(product, origin, images)).toMatchObject({ availability: "unavailable", price: null });
  });
  it.each([-1, 100_000_000, 2.3, NaN, Infinity])("não fabrica oferta com preço legado inválido %s", basePriceCents => {
    expect(projectCatalogItem({ ...item, basePriceCents }, origin, images)).toBeNull();
  });
  it.each([{ id: "../other" }, { slug: "../other" }, { slug: "item?token=a" }, { name: "x".repeat(121) }, { name: "<script>" }])("recusa identidade/texto inválido", invalid => {
    expect(projectCatalogItem({ ...item, ...invalid }, origin, images)).toBeNull();
  });
  it.each(["http://images.example.test/item.webp", "https://images.example.test.evil.test/item.webp", "https://secret@images.example.test/item.webp",
    "https://images.example.test:8443/item.webp", "https://images.example.test/item.webp?token=private", "https://images.example.test/storage/v1/object/sign/private/item.webp", "not a url"])("imagem não pública vira placeholder", raw => {
    expect(publicCatalogImage(raw, images)).toBeNull();
  });
});
