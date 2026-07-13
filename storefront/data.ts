import { cache } from "react";
import { getDatabase } from "../lib/database";
import type {
  StorefrontCategory,
  StorefrontProduct,
  StorefrontStore,
} from "./types";

const productInclude = {
  category: { select: { name: true, slug: true } },
  images: { orderBy: { sortOrder: "asc" as const }, select: { url: true, alt: true } },
  variants: {
    where: { isActive: true },
    orderBy: [{ color: "asc" as const }, { size: "asc" as const }],
    select: {
      id: true,
      name: true,
      sku: true,
      size: true,
      color: true,
      priceCents: true,
      stockQuantity: true,
    },
  },
};

function mapProduct(product: {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  basePriceCents: number;
  compareAtCents: number | null;
  isFeatured: boolean;
  category: { name: string; slug: string } | null;
  images: Array<{ url: string; alt: string | null }>;
  variants: Array<{
    id: string;
    name: string;
    sku: string | null;
    size: string | null;
    color: string | null;
    priceCents: number | null;
    stockQuantity: number;
  }>;
}): StorefrontProduct {
  return {
    ...product,
    available: product.variants.some((variant) => variant.stockQuantity > 0),
  };
}

function mapStore(store: StorefrontStore): StorefrontStore {
  return store;
}

export const getStoreNavigation = cache(async (storeSlug: string) => {
  const database = getDatabase();
  const store = await database.store.findUnique({
    where: { slug: storeSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      whatsapp: true,
      email: true,
      address: true,
      city: true,
      state: true,
      categories: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          imageUrl: true,
          _count: { select: { products: { where: { isActive: true } } } },
        },
      },
    },
  });

  if (!store) return null;

  const categories: StorefrontCategory[] = store.categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    imageUrl: category.imageUrl,
    productCount: category._count.products,
  }));

  return { store: mapStore(store), categories };
});
export const getFeaturedProducts = cache(async (storeSlug: string) => {
  const database = getDatabase();
  const products = await database.product.findMany({
    where: { store: { slug: storeSlug }, isActive: true, isFeatured: true },
    orderBy: { createdAt: "asc" },
    take: 6,
    include: productInclude,
  });

  return products.map(mapProduct);
});

export async function getCatalogProducts(
  storeSlug: string,
  filters: { categorySlug?: string; query?: string } = {},
) {
  const database = getDatabase();
  const query = filters.query?.trim();
  const products = await database.product.findMany({
    where: {
      store: { slug: storeSlug },
      isActive: true,
      ...(filters.categorySlug ? { category: { slug: filters.categorySlug } } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { shortDescription: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
    include: productInclude,
  });

  return products.map(mapProduct);
}

export const getProductBySlug = cache(async (storeSlug: string, productSlug: string) => {
  const database = getDatabase();
  const product = await database.product.findFirst({
    where: { store: { slug: storeSlug }, slug: productSlug, isActive: true },
    include: productInclude,
  });

  return product ? mapProduct(product) : null;
});
