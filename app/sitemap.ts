import type { MetadataRoute } from "next";
import { getStoreRequestOrigin } from "../lib/store-context";
import { getRequestStore } from "../lib/store-context";
import { getSitemapEntries } from "../storefront/data";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await getStoreRequestOrigin();
  const store = await getRequestStore();
  if (!store.isActive) return [];
  const entries = await getSitemapEntries(store.slug);

  return [
    { url: baseUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/produtos`, changeFrequency: "daily", priority: 0.9 },
    ...entries.categories.map((category) => ({
      url: `${baseUrl}/categoria/${category.slug}`,
      lastModified: category.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...entries.products.map((product) => ({
      url: `${baseUrl}/produto/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
