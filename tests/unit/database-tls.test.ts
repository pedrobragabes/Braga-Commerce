import { rootCertificates, type ConnectionOptions } from "node:tls";
import { Client } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPostgresConnectionConfig, normalizePostgresUrl } from "../../lib/database-url";
const remote = "postgresql://fixture:synthetic@database.example.test:5432/fixture";
afterEach(() => vi.unstubAllEnvs());
function driverTls(config: ReturnType<typeof getPostgresConnectionConfig>) {
  // Use the installed driver's actual parser: URL SSL options previously
  // replaced the supposedly secure object before any network connection.
  return (new Client(config) as unknown as { connectionParameters: { ssl: ConnectionOptions | boolean } }).connectionParameters.ssl;
}
describe("PostgreSQL TLS fechado por padrão", () => {
  it.each(["", "?sslmode=require", "?sslmode=verify-ca&uselibpqcompat=true", "?ssl=true&sslnegotiation=direct"])("remoto usa verificação do Node com URL %s", (suffix) => {
    vi.stubEnv("PGSSLMODE", "no-verify");
    const config = getPostgresConnectionConfig(remote + suffix, {});
    expect(driverTls(config)).toEqual({ rejectUnauthorized: true });
    expect(new URL(config.connectionString).searchParams.has("sslmode")).toBe(false);
  });
  it("pooler Supabase não ganha bypass quando falta CA", () => {
    const url = "postgresql://fixture:synthetic@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require";
    expect(driverTls(getPostgresConnectionConfig(url, {}))).toEqual({ rejectUnauthorized: true });
    expect(new URL(normalizePostgresUrl(url)).searchParams.get("sslmode")).toBe("verify-full");
  });
  it("CA customizada válida preserva cadeia e hostname no driver", () => {
    const config = getPostgresConnectionConfig(remote + "?sslmode=require&uselibpqcompat=true", { DATABASE_SSL_CA: rootCertificates[0].replaceAll("\n", "\\n") });
    expect(driverTls(config)).toEqual({ rejectUnauthorized: true, ca: rootCertificates[0].trim() });
  });
  it.each(["?sslmode=no-verify", "?sslmode=disable", "?ssl=no-verify", "?ssl=0", "?ssl=false", "?host=localhost", "?port=9999", "?sslrootcert=local.pem", "?sslkey=secret.pem"])("recusa downgrade/override %s", (suffix) => {
    expect(() => getPostgresConnectionConfig(remote + suffix, { DATABASE_ALLOW_INSECURE_LOCAL: "true" })).toThrow();
  });
  it("recusa PEM falso e URL inválida sem incluir a conexão na mensagem", () => {
    expect(() => getPostgresConnectionConfig(remote, { DATABASE_SSL_CA: "-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----" })).toThrow("certificados PEM válidos");
    expect(() => getPostgresConnectionConfig("not-a-url-with-secret", {})).toThrow("URL PostgreSQL inválida.");
  });
  it("plaintext só loopback local explícito; produção sem flag continua com TLS", () => {
    const local = "postgresql://127.0.0.1:55432/braga_integrity_test";
    expect(driverTls(getPostgresConnectionConfig(local, { NODE_ENV: "test" }))).toBe(false);
    expect(driverTls(getPostgresConnectionConfig(local, { NODE_ENV: "production" }))).toEqual({ rejectUnauthorized: true });
    expect(driverTls(getPostgresConnectionConfig(local, { NODE_ENV: "production", DATABASE_ALLOW_INSECURE_LOCAL: "true" }))).toBe(false);
    expect(driverTls(getPostgresConnectionConfig("postgresql://10.0.0.5/fixture", { NODE_ENV: "development", DATABASE_ALLOW_INSECURE_LOCAL: "true" }))).toEqual({ rejectUnauthorized: true });
    expect(driverTls(getPostgresConnectionConfig(local + "?sslmode=verify-full", { NODE_ENV: "test" }))).toEqual({ rejectUnauthorized: true });
  });
});
