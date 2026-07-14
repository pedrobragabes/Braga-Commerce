import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "../lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const appUrl = getPublicAppUrl();
  const betaProtected = Boolean(
    process.env.SITE_ACCESS_PASSWORD || process.env.SITE_ACCESS_SECRET,
  );

  if (betaProtected) {
    return { rules: { userAgent: "*", disallow: "/" }, host: appUrl };
  }

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
