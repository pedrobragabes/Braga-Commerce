import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { getRuntimeDatabaseUrl, normalizePostgresUrl } from "./database-url";

const globalForDatabase = globalThis as typeof globalThis & {
  bragaCommerceDatabase?: PrismaClient;
};

export function getDatabase() {
  const connectionString = getRuntimeDatabaseUrl();

  if (!connectionString) {
    throw new Error("Uma URL PostgreSQL deve ser configurada para consultar a vitrine.");
  }

  if (!globalForDatabase.bragaCommerceDatabase) {
    globalForDatabase.bragaCommerceDatabase = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: normalizePostgresUrl(connectionString),
        ssl: { rejectUnauthorized: false },
      }),
    });
  }

  return globalForDatabase.bragaCommerceDatabase;
}
