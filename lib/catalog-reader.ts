import { createHash, timingSafeEqual } from "node:crypto";
import { catalogIdPattern } from "./catalog-projection";

const csv = (value?: string) => (value ?? "").split(",").map(part => part.trim()).filter(Boolean);
const instant = (value?: string) => {
  if (!value || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) return NaN;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return NaN;
  const canonical = new Date(parsed).toISOString();
  return value === canonical || value === canonical.replace(".000Z", "Z") ? parsed : NaN;
};
export type CatalogReader = { keyId: string; storeIds: ReadonlySet<string> };

export function authorizeCatalogReader(headers: Pick<Headers, "get">, now = Date.now()): CatalogReader | null {
  if (process.env.BES_CATALOG_ENABLED !== "true") return null;
  const keyId = headers.get("x-bes-key-id");
  const authorization = headers.get("authorization");
  if (!keyId || !catalogIdPattern.test(keyId) || !authorization?.startsWith("Bearer ")) return null;
  const actual = authorization.slice(7);
  if (Buffer.byteLength(actual) < 32 || Buffer.byteLength(actual) > 256 || /\s/.test(actual)) return null;
  const current = { id: process.env.BES_CATALOG_KEY_ID, secret: process.env.BES_CATALOG_API_KEY, stores: process.env.BES_CATALOG_STORE_IDS };
  const previous = { id: process.env.BES_CATALOG_PREVIOUS_KEY_ID, secret: process.env.BES_CATALOG_PREVIOUS_API_KEY, stores: process.env.BES_CATALOG_PREVIOUS_STORE_IDS };
  const from = instant(process.env.BES_CATALOG_ROTATION_STARTED_AT), until = instant(process.env.BES_CATALOG_PREVIOUS_VALID_UNTIL);
  const previousValid = Number.isFinite(from) && Number.isFinite(until) && from <= now && now < until && until > from && until - from <= 86_400_000;
  // Ambiguous identities are a configuration error, not a fallback to v1.
  if (current.id === previous.id || !current.id || !catalogIdPattern.test(current.id)) return null;
  const candidate = keyId === current.id ? current : previousValid && keyId === previous.id ? previous : null;
  if (!candidate?.secret || Buffer.byteLength(candidate.secret) < 32 || Buffer.byteLength(candidate.secret) > 256 || /\s/.test(candidate.secret)) return null;
  if (!timingSafeEqual(createHash("sha256").update(actual).digest(), createHash("sha256").update(candidate.secret).digest())) return null;
  const storeIds = csv(candidate.stores);
  if (storeIds.length > 100 || storeIds.some(id => !catalogIdPattern.test(id))) return null;
  return { keyId, storeIds: new Set(storeIds) };
}
