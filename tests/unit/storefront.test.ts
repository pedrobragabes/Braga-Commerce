import { describe, expect, it } from "vitest";
import { normalizePostgresUrl } from "../../lib/database-url";
import { pvModaConfig } from "../../storefront/config/pv-moda";

describe("storefront customizável", () => {
  it("mantém identidade do cliente fora dos componentes", () => {
    expect(pvModaConfig.storeSlug).toBe("pv-moda-masculina");
    expect(pvModaConfig.theme.brand).toMatch(/^#/);
    expect(pvModaConfig.benefits).toHaveLength(3);
  });

  it("normaliza somente o pooler Supabase para a política TLS suportada", () => {
    const supabase = normalizePostgresUrl(
      "postgresql://user:pass@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require",
    );
    const local = normalizePostgresUrl("postgresql://localhost:5432/braga");

    expect(new URL(supabase).searchParams.get("sslmode")).toBe("no-verify");
    expect(new URL(local).searchParams.has("sslmode")).toBe(false);
  });
});
