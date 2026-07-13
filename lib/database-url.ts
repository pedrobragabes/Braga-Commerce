type DatabaseEnvironment = NodeJS.ProcessEnv;

export function getRuntimeDatabaseUrl(environment: DatabaseEnvironment = process.env) {
  return (
    environment.DATABASE_URL ??
    environment.DATABASE_POSTGRES_PRISMA_URL ??
    environment.DATABASE_POSTGRES_URL_NON_POOLING ??
    null
  );
}
export function normalizePostgresUrl(connectionString: string) {
  const connectionUrl = new URL(connectionString);

  if (connectionUrl.hostname.endsWith(".pooler.supabase.com")) {
    connectionUrl.searchParams.set("sslmode", "no-verify");
  }

  return connectionUrl.toString();
}
