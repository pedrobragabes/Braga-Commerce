import { bridgeReaderAuthorized, bridgeStoreAllowed, getDirectoryProjection } from "../../../../../../../lib/directory-bridge";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ externalStoreId: string }> }) {
  const headers = { "Cache-Control": "private, no-store", "Vary": "Authorization" };
  if (!bridgeReaderAuthorized(request.headers.get("authorization"))) return Response.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
  const { externalStoreId } = await params;
  if (!externalStoreId || externalStoreId.length > 80 || !bridgeStoreAllowed(externalStoreId)) return Response.json({ error: "STORE_NOT_FOUND" }, { status: 404, headers });
  try {
    const projection = await getDirectoryProjection(externalStoreId);
    if (!projection) return Response.json({ error: "STORE_NOT_AVAILABLE" }, { status: 404, headers });
    return Response.json(projection, { headers });
  } catch { return Response.json({ error: "TEMPORARILY_UNAVAILABLE" }, { status: 503, headers }); }
}
