import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_POSTGRES_PRISMA_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // `prisma generate` is part of the Vercel build and does not connect to the
  // database. The Vercel Supabase integration calls its Prisma URL
  // DATABASE_POSTGRES_PRISMA_URL; local and other providers use DATABASE_URL.
  // If neither exists, generate still works while database commands require one.
  ...(databaseUrl
    ? {
        datasource: {
          url: databaseUrl,
        },
      }
    : {}),
});
