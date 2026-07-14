import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "../lib/app-url";
import { pvModaConfig } from "../storefront/config/pv-moda";
import { getSitemapEntries } from "../storefront/data";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getPublicAppUrl();
  const entries = await getSitemapEntries(pvModaConfig.storeSlug);

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
