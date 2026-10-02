import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeCatalogReader } from "../../lib/catalog-reader";

const now = Date.parse("2026-10-02T20:00:00Z");
const secret = "synthetic-current-key-never-used-remotely-000";
const previous = "synthetic-previous-key-never-used-remotely-00";
const request = (key = "key-current", token = secret) => new Headers({ "X-BES-Key-Id": key, Authorization: "Bearer " + token });
beforeEach(() => {
  vi.stubEnv("BES_CATALOG_ENABLED", "true"); vi.stubEnv("BES_CATALOG_KEY_ID", "key-current"); vi.stubEnv("BES_CATALOG_API_KEY", secret);
  vi.stubEnv("BES_CATALOG_STORE_IDS", "store-1,store-2"); vi.stubEnv("BES_CATALOG_PREVIOUS_KEY_ID", "key-previous");
  vi.stubEnv("BES_CATALOG_PREVIOUS_API_KEY", previous); vi.stubEnv("BES_CATALOG_PREVIOUS_STORE_IDS", "store-old");
  vi.stubEnv("BES_CATALOG_ROTATION_STARTED_AT", "2026-10-02T19:00:00Z"); vi.stubEnv("BES_CATALOG_PREVIOUS_VALID_UNTIL", "2026-10-03T19:00:00Z");
});
afterEach(() => vi.unstubAllEnvs());

describe("autorização v2 independente do vínculo v1", () => {
  it("valida identidade, segredo e allowlist específica por chave", () => {
    expect(authorizeCatalogReader(request(), now)).toEqual({ keyId: "key-current", storeIds: new Set(["store-1", "store-2"]) });
    expect(authorizeCatalogReader(request("key-previous", previous), now)?.storeIds).toEqual(new Set(["store-old"]));
    expect(authorizeCatalogReader(request("key-current", previous), now)).toBeNull();
  });
  it("feature flag desativada ou segredo revogado corta a próxima consulta", () => {
    vi.stubEnv("BES_CATALOG_ENABLED", "false"); expect(authorizeCatalogReader(request(), now)).toBeNull();
    vi.stubEnv("BES_CATALOG_ENABLED", "true"); vi.stubEnv("BES_CATALOG_API_KEY", ""); expect(authorizeCatalogReader(request(), now)).toBeNull();
  });
  it.each(["2026-10-02T20:00:00Z", "2026-10-03T19:00:01Z", "2026-10-02T18:00:00Z", "invalid"])("rejeita janela anterior expirada/inválida %s", until => {
    vi.stubEnv("BES_CATALOG_PREVIOUS_VALID_UNTIL", until); expect(authorizeCatalogReader(request("key-previous", previous), now)).toBeNull();
    expect(authorizeCatalogReader(request(), now)).not.toBeNull();
  });
  it("janela ainda não iniciada e IDs ambíguos falham fechados", () => {
    vi.stubEnv("BES_CATALOG_ROTATION_STARTED_AT", "2026-10-02T21:00:00Z"); expect(authorizeCatalogReader(request("key-previous", previous), now)).toBeNull();
    vi.stubEnv("BES_CATALOG_PREVIOUS_KEY_ID", "key-current"); expect(authorizeCatalogReader(request(), now)).toBeNull();
  });
  it("data inexistente não é normalizada para conceder a janela anterior", () => {
    vi.stubEnv("BES_CATALOG_ROTATION_STARTED_AT", "2026-09-31T19:00:00Z");
    vi.stubEnv("BES_CATALOG_PREVIOUS_VALID_UNTIL", "2026-10-02T19:00:00Z");
    expect(authorizeCatalogReader(request("key-previous", previous), Date.parse("2026-10-02T18:00:00Z"))).toBeNull();
  });
  it.each(["short", "a".repeat(257), secret + " space", secret + "\ttab"])("recusa segredo inválido sem fallback", token => {
    expect(authorizeCatalogReader(request("key-current", token), now)).toBeNull();
  });
  it("allowlist inválida ou maior que 100 lojas falha fechada", () => {
    vi.stubEnv("BES_CATALOG_STORE_IDS", "store-1,../other"); expect(authorizeCatalogReader(request(), now)).toBeNull();
    vi.stubEnv("BES_CATALOG_STORE_IDS", Array.from({ length: 101 }, (_, i) => "store-" + i).join(",")); expect(authorizeCatalogReader(request(), now)).toBeNull();
  });
});
