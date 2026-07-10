import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL deve ser configurada antes de executar o seed.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const store = await prisma.store.upsert({
    where: { slug: process.env.SEED_STORE_SLUG ?? "pv-moda-masculina" },
    update: {},
    create: {
      name: process.env.SEED_STORE_NAME ?? "PV Moda Masculina",
      slug: process.env.SEED_STORE_SLUG ?? "pv-moda-masculina",
      whatsapp: process.env.SEED_STORE_WHATSAPP || null,
      settings: { create: {} },
    },
  });

  await Promise.all(
    ["Camisetas", "Camisas", "Calças"].map((name, sortOrder) =>
      prisma.category.upsert({
        where: { storeId_slug: { storeId: store.id, slug: name.toLowerCase() } },
        update: { sortOrder },
        create: { storeId: store.id, name, slug: name.toLowerCase(), sortOrder },
      }),
    ),
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
