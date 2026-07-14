import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { getPostgresConnectionConfig, getRuntimeDatabaseUrl } from "./database-url";

const globalForDatabase = globalThis as typeof globalThis & {
  bragaCommerceDatabase?: PrismaClient;
};

export function getDatabase() {
  const connectionString = getRuntimeDatabaseUrl();

  if (!connectionString) {
    throw new Error("Uma URL PostgreSQL deve ser configurada para consultar a vitrine.");
  }

  if (!globalForDatabase.bragaCommerceDatabase) {
    const connectionConfig = getPostgresConnectionConfig(connectionString);
    globalForDatabase.bragaCommerceDatabase = new PrismaClient({
      adapter: new PrismaPg(connectionConfig),
    });
  }

  return globalForDatabase.bragaCommerceDatabase;
}
