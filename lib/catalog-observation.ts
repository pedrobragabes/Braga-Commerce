type CatalogResult = "ok" | "unauthorized" | "not-found" | "limited" | "unavailable";
const results: Record<CatalogResult, number> = { ok: 0, unauthorized: 0, "not-found": 0, limited: 0, unavailable: 0 };
let durationMs = 0;
let bytes = 0;
export function recordCatalogRead(result: CatalogResult, duration: number, size = 0) {
  results[result] += 1;
  durationMs += Math.max(0, Math.round(duration));
  bytes += Math.max(0, size);
}
// Process-local aggregates only; no headers, request identities, URLs or proofs.
export function catalogReadMetrics() { return { schemaVersion: 2, results: { ...results }, durationMs, bytes }; }
