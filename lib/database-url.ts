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
  return getPostgresConnectionConfig(connectionString).connectionString;
}

export function getPostgresConnectionConfig(
  connectionString: string,
  environment: DatabaseEnvironment = process.env,
) {
  const connectionUrl = new URL(connectionString);
  const certificate = environment.DATABASE_SSL_CA?.replaceAll("\\n", "\n").trim();

  if (!certificate) {
    if (connectionUrl.hostname.endsWith(".pooler.supabase.com")) {
      // Supavisor uses a project CA that must be configured separately.
      // Keep transport encrypted until DATABASE_SSL_CA enables chain validation.
      connectionUrl.searchParams.set("sslmode", "no-verify");
    }
    return { connectionString: connectionUrl.toString() };
  }
  if (
    !certificate.includes("-----BEGIN CERTIFICATE-----") ||
    !certificate.includes("-----END CERTIFICATE-----")
  ) {
    throw new Error("DATABASE_SSL_CA deve conter um certificado PEM válido.");
  }

  // node-postgres lets sslmode from the URL replace the explicit TLS object.
  // Remove it when a trusted CA is supplied so hostname and chain checks remain enabled.
  connectionUrl.searchParams.delete("sslmode");
  connectionUrl.searchParams.delete("sslrootcert");
  return {
    connectionString: connectionUrl.toString(),
    ssl: { ca: certificate, rejectUnauthorized: true as const },
  };
}
