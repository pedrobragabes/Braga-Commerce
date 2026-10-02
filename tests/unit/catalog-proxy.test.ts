import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "../../proxy";

beforeEach(() => { vi.stubEnv("SITE_ACCESS_PASSWORD", "synthetic-beta-password"); vi.stubEnv("SITE_ACCESS_SECRET", "synthetic-beta-secret-with-more-than-32-characters"); });
afterEach(() => vi.unstubAllEnvs());
describe("serviço v2 conserva proteção da prévia", () => {
  it("somente o endpoint exato chega à verificação da chave, sem liberar a loja/painel", async () => {
    const response = await proxy(new NextRequest("https://shop.example.test/api/integrations/bes/v2/stores/store-1/catalog"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    for (const pathname of ["/", "/admin/integracoes", "/api/integrations/bes/v2", "/api/integrations/bes/v2/stores/store-1/catalog/extra", "/api/integrations/bes/v2/stores/store-1/other"]) {
      const blocked = await proxy(new NextRequest("https://shop.example.test" + pathname));
      expect(blocked.status).toBe(307); expect(new URL(blocked.headers.get("location")!).pathname).toBe("/acesso-beta");
    }
  });
});
