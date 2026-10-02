import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { getDatabase } from "./database";
import { canonicalStoreUrl } from "./directory-bridge";
import { subscriptionAllowsCheckout } from "./store-lifecycle";
import { defaultStoreTheme, storeThemeSchema } from "./store-theme";
import { CATALOG_MAX_BYTES, CATALOG_MAX_ITEMS, CATALOG_TTL_MS, projectCatalogItem } from "./catalog-projection";
import { catalogConsentCurrent } from "./catalog-sharing";

export async function getDirectoryCatalog(storeId: string, budgetMs = 1800) {
  const timeout = Math.max(1, Math.min(1800, Math.floor(budgetMs)));
  return getDatabase().$transaction(async transaction => {
    await transaction.$queryRaw`SELECT set_config('statement_timeout', ${String(Math.max(1, timeout - 200))}, true)`;
    const now = new Date();
    const store = await transaction.store.findUnique({ where: { id: storeId }, include: {
      directoryBinding: true, settings: true, subscription: { include: { plan: true } },
    } });
    if (!store) return null;
    const canonicalUrl = canonicalStoreUrl(store);
    if (!canonicalUrl) return null;
    const binding = store.directoryBinding;
    const operator = binding?.catalogConsentActorId ? await transaction.user.findFirst({ where: { id: binding.catalogConsentActorId, storeId } }) : null;
    const commerceEnabled = store.isActive && (store.salesAccessMode === "LEGACY_PILOT" && !store.subscription || subscriptionAllowsCheckout(store.subscription, now));
    const catalogSharingEnabled = catalogConsentCurrent(binding, operator);
    const revision = store.settings?.themePublishedVersion ? await transaction.storeThemeRevision.findUnique({ where: {
      storeId_version: { storeId, version: store.settings.themePublishedVersion },
    } }) : null;
    const theme = storeThemeSchema.safeParse(revision?.content);
    const displayName = theme.success ? theme.data.name : defaultStoreTheme(store).name;
    const products = commerceEnabled && catalogSharingEnabled ? await transaction.product.findMany({
      where: { storeId, isActive: true }, orderBy: { id: "asc" }, take: CATALOG_MAX_ITEMS,
      select: { id: true, slug: true, name: true, basePriceCents: true, stockQuantity: true, hasVariants: true,
        images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], take: 1, select: { url: true } } },
    }) : [];
    // Aggregate in SQL rather than loading an unbounded set of variant rows.
    const variantIds = products.filter(product => product.hasVariants).map(product => product.id);
    const ranges = variantIds.length ? await transaction.$queryRaw<Array<{ productId: string; min: number; max: number }>>(Prisma.sql`
      SELECT v."productId", MIN(COALESCE(v."priceCents", p."basePriceCents")) AS "min", MAX(COALESCE(v."priceCents", p."basePriceCents")) AS "max"
      FROM "ProductVariant" v JOIN "Product" p ON p."id" = v."productId"
      WHERE v."productId" IN (${Prisma.join(variantIds)}) AND v."isActive" = true AND v."stockQuantity" > 0
      GROUP BY v."productId"
    `) : [];
    const imageHosts = new Set((process.env.BES_CATALOG_IMAGE_HOSTS ?? "").split(",").map(host => host.trim()).filter(Boolean));
    const items = products.map(product => projectCatalogItem({ ...product, variants: [],
      variantPriceRange: ranges.find(range => range.productId === product.id) ?? null }, canonicalUrl, imageHosts)).filter(item => item !== null);
    const projection = { schemaVersion: 2 as const, store: { id: store.id, displayName, canonicalUrl, commerceEnabled, catalogSharingEnabled,
      directoryBinding: binding ? { commerceId: binding.commerceId, origin: binding.origin, challengeHash: binding.challengeHash } : null },
      emittedAt: now.toISOString(), expiresAt: new Date(now.getTime() + CATALOG_TTL_MS).toISOString(), projectionRevision: randomUUID(), items };
    if (Buffer.byteLength(JSON.stringify(projection)) > CATALOG_MAX_BYTES) throw new Error("CATALOG_LIMIT_EXCEEDED");
    return projection;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: Math.min(100, timeout), timeout });
}
