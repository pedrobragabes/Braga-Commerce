export const CATALOG_MAX_ITEMS = 12;
export const CATALOG_MAX_BYTES = 64 * 1024;
export const CATALOG_TTL_MS = 60_000;
export const catalogIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

export type CatalogProduct = {
  id: string; slug: string; name: string; basePriceCents: number;
  stockQuantity: number; hasVariants: boolean;
  images: Array<{ url: string }>;
  variants: Array<{ isActive: boolean; stockQuantity: number; priceCents: number | null }>;
  variantPriceRange?: { min: number; max: number } | null;
};
export type CatalogItem = {
  id: string; slug: string; name: string; canonicalUrl: string; imageUrl: string | null;
  availability: "available" | "unavailable";
  price: { currency: "BRL"; min: number; max: number } | null;
};

const validPrice = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 99_999_999;

export function publicCatalogImage(raw: string | undefined, allowedHosts: ReadonlySet<string>) {
  if (!raw || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    // Signed or private object URLs must never be republished as public images.
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash
      || !allowedHosts.has(url.host) || url.pathname.includes("/object/sign/")) return null;
    return url.href;
  } catch { return null; }
}

export function projectCatalogItem(product: CatalogProduct, canonicalOrigin: string, imageHosts: ReadonlySet<string>): CatalogItem | null {
  if (!catalogIdPattern.test(product.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug) || product.slug.length > 120
    || !product.name.trim() || product.name.length > 120 || /[<>\u0000-\u001f\u007f]/.test(product.name)) return null;
  const prices = product.hasVariants
    ? product.variantPriceRange !== undefined
      ? product.variantPriceRange ? [product.variantPriceRange.min, product.variantPriceRange.max] : []
      : product.variants.filter(variant => variant.isActive && variant.stockQuantity > 0).map(variant => variant.priceCents ?? product.basePriceCents)
    : product.stockQuantity > 0 ? [product.basePriceCents] : [];
  // Malformed legacy amounts do not become an offer with a fabricated price.
  if (prices.some(value => !validPrice(value))) return null;
  const available = prices.length > 0;
  return { id: product.id, slug: product.slug, name: product.name, canonicalUrl: `${canonicalOrigin}/produto/${encodeURIComponent(product.slug)}`,
    imageUrl: publicCatalogImage(product.images[0]?.url, imageHosts), availability: available ? "available" : "unavailable",
    price: available ? { currency: "BRL", min: Math.min(...prices), max: Math.max(...prices) } : null };
}
