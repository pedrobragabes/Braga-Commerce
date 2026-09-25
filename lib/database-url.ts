import { X509Certificate } from "node:crypto";
type DatabaseEnvironment = Record<string, string | undefined>;

export function getRuntimeDatabaseUrl(environment: DatabaseEnvironment = process.env) {
  return (
    environment.DATABASE_URL ??
    environment.DATABASE_POSTGRES_PRISMA_URL ??
    environment.DATABASE_POSTGRES_URL_NON_POOLING ??
    null
  );
}
export function normalizePostgresUrl(connectionString: string) {
  const config = getPostgresConnectionConfig(connectionString);
  const url = new URL(config.connectionString);
  // String-only consumers retain verification too; use the full config when a
  // custom CA is needed, since PEM is never serialized into a connection URL.
  if (config.ssl !== false) url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

export function getPostgresConnectionConfig(
  connectionString: string,
  environment: DatabaseEnvironment = process.env,
) {
  let connectionUrl: URL;
  try { connectionUrl = new URL(connectionString); }
  catch { throw new Error("URL PostgreSQL inválida."); }
  if (!["postgres:", "postgresql:"].includes(connectionUrl.protocol) || !connectionUrl.hostname
    || ["host", "hostaddr", "port", "service"].some((key) => connectionUrl.searchParams.has(key))) throw new Error("Destino PostgreSQL inválido; use hostname e porta na autoridade da URL.");
  const certificate = environment.DATABASE_SSL_CA?.replaceAll("\\n", "\n").trim();
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(connectionUrl.hostname);
  const allowLocalPlaintext = local && (environment.NODE_ENV !== "production" || environment.DATABASE_ALLOW_INSECURE_LOCAL === "true");
  const sslMode = connectionUrl.searchParams.get("sslmode");
  const ssl = connectionUrl.searchParams.get("ssl");
  if ((sslMode && !["disable", "require", "prefer", "verify-ca", "verify-full"].includes(sslMode))
    || (ssl && !["0", "1", "true", "false"].includes(ssl))
    || (!allowLocalPlaintext && (sslMode === "disable" || ssl === "0" || ssl === "false"))) throw new Error("PostgreSQL exige validação TLS; opções inseguras não são permitidas.");
  if (["sslrootcert", "sslcert", "sslkey"].some((key) => connectionUrl.searchParams.has(key))) throw new Error("Configure a CA em DATABASE_SSL_CA; arquivos TLS na URL não são aceitos.");
  if (certificate) {
    try {
      const certificates = certificate.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
      if (!certificates?.length || certificate.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g, "").trim()) throw new Error();
      for (const pem of certificates) new X509Certificate(pem);
    } catch { throw new Error("DATABASE_SSL_CA deve conter certificados PEM válidos."); }
  }
  // pg-connection-string takes precedence over the explicit ssl object. Remove
  // every recognized SSL override, including ssl=0 and libpq compatibility.
  for (const key of ["ssl", "sslmode", "sslrootcert", "sslcert", "sslkey", "sslnegotiation", "uselibpqcompat"]) connectionUrl.searchParams.delete(key);
  const requestedTls = (sslMode && sslMode !== "disable") || ssl === "1" || ssl === "true" || certificate;
  return {
    connectionString: connectionUrl.toString(),
    ssl: allowLocalPlaintext && !requestedTls ? false as const
      : { ...(certificate ? { ca: certificate } : {}), rejectUnauthorized: true as const },
  };
}
