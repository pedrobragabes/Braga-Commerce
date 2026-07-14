import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "../lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const appUrl = getPublicAppUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/carrinho", "/checkout", "/pedido/"],
    },
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
