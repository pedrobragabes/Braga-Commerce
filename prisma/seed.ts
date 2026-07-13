import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { normalizePostgresUrl } from "../lib/database-url";
import { PV_MODA_CATEGORIES, PV_MODA_PRODUCTS, validatePvModaSeed } from "./seed-data";

const connectionString =
  process.env.DATABASE_URL ?? process.env.DATABASE_POSTGRES_PRISMA_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL ou DATABASE_POSTGRES_PRISMA_URL deve ser configurada antes de executar o seed.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: normalizePostgresUrl(connectionString),
    // Supavisor's pooler can expose a certificate chain that Node does not
    // trust by default. The connection remains encrypted; this only bypasses
    // chain validation for this hosted database connection.
    ssl: { rejectUnauthorized: false },
  }),
});

async function main() {
  validatePvModaSeed();

  const storeName = process.env.SEED_STORE_NAME ?? "PV Moda Masculina";
  const storeSlug = process.env.SEED_STORE_SLUG ?? "pv-moda-masculina";
  const localDeliveryFeeCents = Number(process.env.SEED_LOCAL_DELIVERY_FEE_CENTS ?? 0);

  if (!Number.isInteger(localDeliveryFeeCents) || localDeliveryFeeCents < 0) {
    throw new Error("SEED_LOCAL_DELIVERY_FEE_CENTS deve ser um inteiro não negativo.");
  }

  const store = await prisma.store.upsert({
    where: { slug: storeSlug },
    update: { name: storeName },
    create: {
      name: storeName,
      slug: storeSlug,
      whatsapp: process.env.SEED_STORE_WHATSAPP || null,
      settings: { create: {} },
    },
  });

  await prisma.storeSettings.upsert({
    where: { storeId: store.id },
    update: {
      allowLocalPickup: true,
      allowLocalDelivery: process.env.SEED_ALLOW_LOCAL_DELIVERY !== "false",
      localDeliveryFeeCents,
    },
    create: {
      storeId: store.id,
      allowLocalPickup: true,
      allowLocalDelivery: process.env.SEED_ALLOW_LOCAL_DELIVERY !== "false",
      localDeliveryFeeCents,
    },
  });

  const categories = await Promise.all(
    PV_MODA_CATEGORIES.map((category) =>
      prisma.category.upsert({
        where: { storeId_slug: { storeId: store.id, slug: category.slug } },
        update: { name: category.name, sortOrder: category.sortOrder, isActive: true },
        create: { storeId: store.id, ...category },
      }),
    ),
  );

  const categoryBySlug = new Map(categories.map((category) => [category.slug, category.id]));

  for (const productData of PV_MODA_PRODUCTS) {
    const categoryId = categoryBySlug.get(productData.categorySlug);

    if (!categoryId) {
      throw new Error(`Categoria não encontrada para ${productData.slug}.`);
    }

    const product = await prisma.product.upsert({
      where: { storeId_slug: { storeId: store.id, slug: productData.slug } },
      update: {
        categoryId,
        name: productData.name,
        sku: productData.sku,
        shortDescription: productData.shortDescription,
        description: productData.description,
        basePriceCents: productData.basePriceCents,
        compareAtCents: productData.compareAtCents ?? null,
        isActive: true,
        isFeatured: productData.isFeatured ?? false,
        hasVariants: true,
      },
      create: {
        storeId: store.id,
        categoryId,
        name: productData.name,
        slug: productData.slug,
        sku: productData.sku,
        shortDescription: productData.shortDescription,
        description: productData.description,
        basePriceCents: productData.basePriceCents,
        compareAtCents: productData.compareAtCents ?? null,
        isActive: true,
        isFeatured: productData.isFeatured ?? false,
        hasVariants: true,
      },
    });

    for (const variantData of productData.variants) {
      await prisma.productVariant.upsert({
        where: { productId_sku: { productId: product.id, sku: variantData.sku } },
        update: {
          name: variantData.name,
          size: variantData.size,
          color: variantData.color,
          stockQuantity: variantData.stockQuantity,
          isActive: true,
        },
        create: { productId: product.id, ...variantData, isActive: true },
      });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
