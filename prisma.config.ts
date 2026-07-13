import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.DATABASE_POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_POSTGRES_PRISMA_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // `prisma generate` is part of the Vercel build and does not connect to the
  // database. Migrations prefer the Vercel Supabase session pooler on port
  // 5432; serverless runtime traffic uses DATABASE_POSTGRES_PRISMA_URL on 6543.
  // Local and other providers can keep using DATABASE_URL.
  ...(databaseUrl
    ? {
        datasource: {
          url: databaseUrl,
        },
      }
    : {}),
});
