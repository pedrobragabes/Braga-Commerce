import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDatabase } from "./database";

export function normalizeStoreHost(rawHost: string | null) {
  if (!rawHost || rawHost.length > 260 || /[\s/@\\,?#]/.test(rawHost)) return null;
  try {
    const url = new URL(`http://${rawHost}`);
    return url.hostname.toLowerCase().replace(/\.$/, "");
  } catch { return null; }
}

export async function resolveStoreHost(rawHost: string | null) {
  const host = normalizeStoreHost(rawHost);
  if (!host) return null;
  const database = getDatabase();
  const byDomain = await database.store.findUnique({ where: { domain: host }, select: { id: true, slug: true, isActive: true } });
  if (byDomain) return byDomain;
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  let configuredHost: string | undefined;
  try { configuredHost = configured ? new URL(configured).hostname : undefined; } catch { return null; }
  const allowed = ["localhost", "127.0.0.1", "[::1]", configuredHost, process.env.VERCEL_URL].filter(Boolean);
  if (!allowed.includes(host)) return null;
  // Compatibility for the existing deployment; new instances set STORE_SLUG.
  const slug = process.env.STORE_SLUG || "pv-moda-masculina";
  return database.store.findUnique({ where: { slug }, select: { id: true, slug: true, isActive: true } });
}

export const getRequestStore = cache(async () => {
  const store = await resolveStoreHost((await headers()).get("host"));
  if (!store) notFound();
  return store;
});

export async function getRequestStoreSlug() { return (await getRequestStore()).slug; }

export async function matchRequestStore(request: Request, slug?: string) {
  const store = await resolveStoreHost(request.headers.get("host") ?? new URL(request.url).host);
  return store && (!slug || store.slug === slug) ? store : null;
}

export async function getStoreRequestOrigin(request?: Request) {
  const rawHost = request ? request.headers.get("host") ?? new URL(request.url).host : (await headers()).get("host");
  const store = await resolveStoreHost(rawHost);
  const host = normalizeStoreHost(rawHost);
  if (!store || !host) throw new Error("STORE_ORIGIN_UNAVAILABLE");
  if (["localhost", "127.0.0.1", "[::1]"].includes(host) || host.endsWith(".localhost")) return new URL(`http://${rawHost}`).origin;
  const allowed = (process.env.STORE_PUBLIC_ALLOWED_HOSTS ?? "").split(",").map((value) => value.trim());
  if (allowed.includes(host)) return `https://${host}`;
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured && new URL(configured).hostname === host) return new URL(configured).origin;
  throw new Error("STORE_ORIGIN_UNAVAILABLE");
}
