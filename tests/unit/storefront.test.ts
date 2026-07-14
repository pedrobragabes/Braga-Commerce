import { describe, expect, it } from "vitest";
import { getPostgresConnectionConfig, normalizePostgresUrl } from "../../lib/database-url";
import { pvModaConfig } from "../../storefront/config/pv-moda";

describe("storefront customizável", () => {
  it("mantém identidade do cliente fora dos componentes", () => {
    expect(pvModaConfig.storeSlug).toBe("pv-moda-masculina");
    expect(pvModaConfig.theme.brand).toMatch(/^#/);
    expect(pvModaConfig.benefits).toHaveLength(3);
  });

  it("preserva TLS obrigatório e habilita validação por CA quando configurada", () => {
    const supabase = normalizePostgresUrl(
      "postgresql://user:pass@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require",
    );
    const local = normalizePostgresUrl("postgresql://localhost:5432/braga");

    const withCa = getPostgresConnectionConfig(supabase, {
      DATABASE_SSL_CA: "-----BEGIN CERTIFICATE-----\\ntrusted-ca\\n-----END CERTIFICATE-----",
    });

    expect(new URL(supabase).searchParams.get("sslmode")).toBe("no-verify");
    expect(new URL(local).searchParams.has("sslmode")).toBe(false);
    expect(new URL(withCa.connectionString).searchParams.has("sslmode")).toBe(false);
    expect(withCa.ssl?.rejectUnauthorized).toBe(true);
  });
});
