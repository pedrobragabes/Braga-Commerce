import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getDatabase } from "./database";
import { can } from "./admin-auth";
import { lockStore, StoreLifecycleError, subscriptionAllowsCheckout } from "./store-lifecycle";
import { getStorePresentation } from "./store-theme";

function csv(value?: string) { return (value ?? "").split(",").map((part) => part.trim()).filter(Boolean); }

export function bridgeReaderAuthorized(authorization: string | null) {
  const expected = process.env.BES_BRIDGE_API_KEY;
  const actual = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!expected || expected.length < 32 || !actual || actual.length > 1000) return false;
  return timingSafeEqual(createHash("sha256").update(actual).digest(), createHash("sha256").update(expected).digest());
}
export function bridgeStoreAllowed(storeId: string) { return csv(process.env.BES_BRIDGE_STORE_IDS).includes(storeId); }

export function canonicalStoreUrl(store: { domain: string | null; slug: string }) {
  const fallback = store.slug === (process.env.STORE_SLUG || "pv-moda-masculina") ? process.env.NEXT_PUBLIC_APP_URL : undefined;
  const raw = store.domain ? `https://${store.domain}` : fallback;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash
      || !csv(process.env.STORE_PUBLIC_ALLOWED_HOSTS).includes(url.hostname)) return null;
    return url.origin;
  } catch { return null; }
}

const bindingSchema = z.object({ commerceId: z.number().int().positive(), origin: z.url(), challenge: z.string().regex(/^[a-fA-F0-9]{64}$/) }).strict();

export async function saveDirectoryBinding(actor: { userId: string; storeId: string }, input: unknown) {
  const data = bindingSchema.parse(input);
  const origin = new URL(data.origin);
  const localPreview = process.env.BES_BRIDGE_MODE === "local" && (process.env.NODE_ENV === "test" || Boolean(process.env.SITE_ACCESS_PASSWORD))
    && origin.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname);
  if (origin.protocol !== "https:" && !localPreview || origin.origin !== data.origin || !csv(process.env.BES_ALLOWED_ORIGINS).includes(origin.origin)) {
    throw new StoreLifecycleError("DIRECTORY_ORIGIN_NOT_ALLOWED");
  }
  return getDatabase().$transaction(async (transaction) => {
    const operator = await transaction.user.findFirst({ where: { id: actor.userId, storeId: actor.storeId, isActive: true } });
    if (!operator || !can(operator.role, "settings:write")) throw new StoreLifecycleError("FORBIDDEN");
    await lockStore(transaction, actor.storeId);
    // The one-time secret is never persisted or logged, only its proof hash.
    const challengeHash = createHash("sha256").update(data.challenge).digest("hex");
    const value = { commerceId: data.commerceId, origin: origin.origin, challengeHash, actorId: actor.userId };
    const binding = await transaction.storeDirectoryBinding.upsert({ where: { storeId: actor.storeId }, update: value, create: { storeId: actor.storeId, ...value } });
    await transaction.storeAuditEvent.create({ data: { storeId: actor.storeId, actorId: actor.userId, action: "DIRECTORY_BINDING_SET", reference: binding.id } });
    return { commerceId: binding.commerceId, origin: binding.origin };
  });
}

export async function removeDirectoryBinding(actor: { userId: string; storeId: string }) {
  return getDatabase().$transaction(async (transaction) => {
    const operator = await transaction.user.findFirst({ where: { id: actor.userId, storeId: actor.storeId, isActive: true } });
    if (!operator || !can(operator.role, "settings:write")) throw new StoreLifecycleError("FORBIDDEN");
    await lockStore(transaction, actor.storeId);
    await transaction.storeDirectoryBinding.deleteMany({ where: { storeId: actor.storeId } });
    await transaction.storeAuditEvent.create({ data: { storeId: actor.storeId, actorId: actor.userId, action: "DIRECTORY_BINDING_REMOVED", reference: actor.storeId } });
  });
}

export async function getDirectoryProjection(storeId: string) {
  const store = await getDatabase().store.findUnique({ where: { id: storeId }, include: { directoryBinding: true, subscription: { include: { plan: true } } } });
  if (!store) return null;
  const canonicalUrl = canonicalStoreUrl(store);
  if (!canonicalUrl) return null;
  const presentation = await getStorePresentation(store.id);
  const commerceEnabled = store.isActive && (store.salesAccessMode === "LEGACY_PILOT" && !store.subscription || subscriptionAllowsCheckout(store.subscription));
  return { schemaVersion: 1 as const, store: { id: store.id, displayName: presentation.content.name, canonicalUrl, commerceEnabled,
    directoryBinding: store.directoryBinding ? { commerceId: store.directoryBinding.commerceId, origin: store.directoryBinding.origin, challengeHash: store.directoryBinding.challengeHash } : null }, fetchedAt: new Date().toISOString() };
}
