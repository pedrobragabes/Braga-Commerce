import { authorizeCatalogReader } from "../../../../../../../../lib/catalog-reader";
import { catalogIdPattern } from "../../../../../../../../lib/catalog-projection";
import { getDirectoryCatalog } from "../../../../../../../../lib/directory-catalog";
import { checkCatalogQuota } from "../../../../../../../../lib/catalog-rate-limit";
import { recordCatalogRead } from "../../../../../../../../lib/catalog-observation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization, X-BES-Key-Id" };
let inFlight = 0;

export async function GET(request: Request, { params }: { params: Promise<{ externalStoreId: string }> }) {
  const started = performance.now();
  const reader = authorizeCatalogReader(request.headers);
  if (!reader) {
    recordCatalogRead("unauthorized", performance.now() - started);
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
  }
  const { externalStoreId } = await params;
  if (!catalogIdPattern.test(externalStoreId) || !reader.storeIds.has(externalStoreId)) {
    recordCatalogRead("not-found", performance.now() - started);
    return Response.json({ error: "STORE_NOT_FOUND" }, { status: 404, headers });
  }
  if (inFlight >= 100) {
    recordCatalogRead("limited", performance.now() - started);
    return Response.json({ error: "RATE_LIMITED" }, { status: 429, headers: { ...headers, "Retry-After": "1" } });
  }
  inFlight++;
  try {
    const quota = await checkCatalogQuota(reader.keyId, externalStoreId);
    if (!quota.allowed) {
      recordCatalogRead("limited", performance.now() - started);
      return Response.json({ error: "RATE_LIMITED" }, { status: 429, headers: { ...headers, "Retry-After": String(quota.retryAfter) } });
    }
    const remaining = 1900 - (performance.now() - started);
    if (remaining <= 0) throw new Error("CATALOG_DEADLINE_EXCEEDED");
    const projection = await getDirectoryCatalog(externalStoreId, remaining);
    // Environment changes/revocation during I/O cannot reuse prior authority.
    const current = authorizeCatalogReader(request.headers);
    if (!current || current.keyId !== reader.keyId) {
      recordCatalogRead("unauthorized", performance.now() - started);
      return Response.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
    }
    if (!current.storeIds.has(externalStoreId) || !projection) {
      recordCatalogRead("not-found", performance.now() - started);
      return Response.json({ error: "STORE_NOT_AVAILABLE" }, { status: 404, headers });
    }
    if (performance.now() - started >= 2000) throw new Error("CATALOG_DEADLINE_EXCEEDED");
    const body = JSON.stringify(projection);
    recordCatalogRead("ok", performance.now() - started, Buffer.byteLength(body));
    return new Response(body, { headers: { ...headers, "Content-Type": "application/json" } });
  } catch {
    recordCatalogRead("unavailable", performance.now() - started);
    return Response.json({ error: "TEMPORARILY_UNAVAILABLE" }, { status: 503, headers });
  } finally { inFlight--; }
}
