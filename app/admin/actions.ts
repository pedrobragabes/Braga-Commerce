"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FulfillmentStatus } from "../../generated/prisma/client";
import { requireAdminAction } from "../../lib/admin-auth";
import {
  canTransitionFulfillment,
  parseAdminColor,
  parseAdminInteger,
  parseAdminMoney,
  parseAdminState,
  slugifyAdminValue,
} from "../../lib/admin-rules";
import { getDatabase } from "../../lib/database";
import { moveStoredProductImage, removeStoredProductImage } from "../../lib/storage/product-images";

const idSchema = z.string().min(1).max(80);
const optionalText = z.string().trim().max(500).optional();

function checkbox(formData: FormData, name: string) {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

function requiredText(formData: FormData, name: string, max = 160) {
  return z.string().trim().min(1).max(max).parse(formData.get(name));
}

function optionalFormText(formData: FormData, name: string, max = 500) {
  const value = z.string().trim().max(max).parse(formData.get(name) ?? "");
  return value || null;
}

function money(formData: FormData, name: string) {
  const value = parseAdminMoney(String(formData.get(name) ?? ""));
  if (value === null) throw new Error("INVALID_MONEY");
  return value;
}

export async function createProduct(formData: FormData) {
  const session = await requireAdminAction("catalog:write");
  const name = requiredText(formData, "name");
  const slug = slugifyAdminValue(String(formData.get("slug") || name));
  const categoryId = optionalFormText(formData, "categoryId", 80);
  const stockQuantity = parseAdminInteger(String(formData.get("stockQuantity") ?? "0"));
  if (!slug) throw new Error("INVALID_SLUG");
  if (stockQuantity === null) throw new Error("INVALID_STOCK");

  const database = getDatabase();
  if (categoryId) {
    const category = await database.category.findFirst({ where: { id: categoryId, storeId: session.storeId } });
    if (!category) throw new Error("CATEGORY_NOT_FOUND");
  }
  const product = await database.product.create({
    data: {
      storeId: session.storeId,
      categoryId,
      name,
      slug,
      sku: optionalFormText(formData, "sku", 80),
      shortDescription: optionalFormText(formData, "shortDescription", 240),
      description: optionalFormText(formData, "description", 4000),
      basePriceCents: money(formData, "basePrice"),
      stockQuantity,
      hasVariants: checkbox(formData, "hasVariants"),
      isActive: checkbox(formData, "isActive"),
      isFeatured: checkbox(formData, "isFeatured"),
    },
  });
  revalidatePath("/admin/produtos");
  revalidatePath("/produtos");
  redirect(`/admin/produtos/${product.id}?saved=created`);
}

export async function updateProduct(formData: FormData) {
  const session = await requireAdminAction("catalog:write");
  const productId = idSchema.parse(formData.get("productId"));
  const product = await getDatabase().product.findFirst({ where: { id: productId, storeId: session.storeId } });
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  const name = requiredText(formData, "name");
  const slug = slugifyAdminValue(String(formData.get("slug") || name));
  const categoryId = optionalFormText(formData, "categoryId", 80);
  const stockQuantity = parseAdminInteger(String(formData.get("stockQuantity") ?? "0"));
  if (!slug || stockQuantity === null) throw new Error("INVALID_PRODUCT");

  const database = getDatabase();
  if (categoryId) {
    const category = await database.category.findFirst({ where: { id: categoryId, storeId: session.storeId } });
    if (!category) throw new Error("CATEGORY_NOT_FOUND");
  }
  await database.product.update({
    where: { id: product.id },
    data: {
      categoryId,
      name,
      slug,
      sku: optionalFormText(formData, "sku", 80),
      shortDescription: optionalFormText(formData, "shortDescription", 240),
      description: optionalFormText(formData, "description", 4000),
      basePriceCents: money(formData, "basePrice"),
      compareAtCents: formData.get("compareAt") ? money(formData, "compareAt") : null,
      stockQuantity,
      hasVariants: checkbox(formData, "hasVariants"),
      isActive: checkbox(formData, "isActive"),
      isFeatured: checkbox(formData, "isFeatured"),
    },
  });
  revalidatePath("/admin/produtos");
  revalidatePath(`/admin/produtos/${product.id}`);
  revalidatePath("/produtos");
  redirect(`/admin/produtos/${product.id}?saved=updated`);
}

export async function toggleProduct(formData: FormData) {
  const session = await requireAdminAction("catalog:write");
  const productId = idSchema.parse(formData.get("productId"));
  const product = await getDatabase().product.findFirst({ where: { id: productId, storeId: session.storeId } });
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  await getDatabase().product.update({ where: { id: product.id }, data: { isActive: !product.isActive } });
  revalidatePath("/admin/produtos");
  revalidatePath("/produtos");
}

export async function moveProductImage(formData: FormData) {
  const session = await requireAdminAction("images:write");
  const productId = idSchema.parse(formData.get("productId"));
  const imageId = idSchema.parse(formData.get("imageId"));
  const direction = z.enum(["up", "down"]).parse(formData.get("direction"));
  const product = await moveStoredProductImage({ storeId: session.storeId, productId, imageId, direction });
  revalidatePath(`/admin/produtos/${product.id}`);
  revalidatePath(`/produto/${product.slug}`);
}

export async function removeProductImage(formData: FormData) {
  const session = await requireAdminAction("images:write");
  const productId = idSchema.parse(formData.get("productId"));
  const imageId = idSchema.parse(formData.get("imageId"));
  const product = await removeStoredProductImage({ storeId: session.storeId, productId, imageId });
  revalidatePath(`/admin/produtos/${product.id}`);
  revalidatePath(`/produto/${product.slug}`);
}

export async function saveVariant(formData: FormData) {
  const session = await requireAdminAction("inventory:write");
  const productId = idSchema.parse(formData.get("productId"));
  const variantId = optionalFormText(formData, "variantId", 80);
  const product = await getDatabase().product.findFirst({ where: { id: productId, storeId: session.storeId } });
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  const stockQuantity = parseAdminInteger(String(formData.get("stockQuantity") ?? ""));
  if (stockQuantity === null) throw new Error("INVALID_STOCK");
  const data = {
    name: requiredText(formData, "name", 120),
    sku: optionalFormText(formData, "sku", 80),
    size: optionalFormText(formData, "size", 40),
    color: optionalFormText(formData, "color", 60),
    priceCents: formData.get("price") ? money(formData, "price") : null,
    stockQuantity,
    isActive: checkbox(formData, "isActive"),
  };
  const database = getDatabase();
  if (variantId) {
    const variant = await database.productVariant.findFirst({ where: { id: variantId, productId: product.id } });
    if (!variant) throw new Error("VARIANT_NOT_FOUND");
    await database.productVariant.update({ where: { id: variant.id }, data });
  } else {
    await database.productVariant.create({ data: { productId: product.id, ...data } });
    if (!product.hasVariants) {
      await database.product.update({ where: { id: product.id }, data: { hasVariants: true, stockQuantity: 0 } });
    }
  }
  revalidatePath(`/admin/produtos/${product.id}`);
  revalidatePath(`/produto/${product.slug}`);
  redirect(`/admin/produtos/${product.id}?saved=variant`);
}

export async function saveCategory(formData: FormData) {
  const session = await requireAdminAction("catalog:write");
  const categoryId = optionalFormText(formData, "categoryId", 80);
  const name = requiredText(formData, "name", 120);
  const slug = slugifyAdminValue(String(formData.get("slug") || name));
  const sortOrder = parseAdminInteger(String(formData.get("sortOrder") ?? "0"));
  if (!slug || sortOrder === null) throw new Error("INVALID_CATEGORY");
  const data = {
    name,
    slug,
    description: optionalFormText(formData, "description", 500),
    sortOrder,
    isActive: checkbox(formData, "isActive"),
  };
  const database = getDatabase();
  if (categoryId) {
    const category = await database.category.findFirst({ where: { id: categoryId, storeId: session.storeId } });
    if (!category) throw new Error("CATEGORY_NOT_FOUND");
    await database.category.update({ where: { id: category.id }, data });
  } else {
    await database.category.create({ data: { storeId: session.storeId, ...data } });
  }
  revalidatePath("/admin/categorias");
  revalidatePath("/");
  redirect("/admin/categorias?saved=1");
}

export async function updateOrderOperation(formData: FormData) {
  const session = await requireAdminAction("orders:write");
  const orderId = idSchema.parse(formData.get("orderId"));
  const nextStatus = z.enum([
    "NOT_FULFILLED", "PREPARING", "READY_FOR_PICKUP", "SHIPPED", "DELIVERED", "CANCELLED",
  ]).parse(formData.get("fulfillmentStatus")) as FulfillmentStatus;
  const database = getDatabase();
  const order = await database.order.findFirst({ where: { id: orderId, storeId: session.storeId } });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (!canTransitionFulfillment(order.fulfillmentStatus, nextStatus)) throw new Error("INVALID_FULFILLMENT_TRANSITION");
  await database.order.update({
    where: { id: order.id },
    data: {
      fulfillmentStatus: nextStatus,
      internalNote: optionalText.parse(String(formData.get("internalNote") ?? "")) || null,
    },
  });
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${order.id}`);
  redirect(`/admin/pedidos/${order.id}?saved=1`);
}

export async function updateStoreSettings(formData: FormData) {
  const session = await requireAdminAction("settings:write");
  const localDeliveryFeeCents = money(formData, "localDeliveryFee");
  const email = optionalFormText(formData, "email", 160);
  const stateInput = optionalFormText(formData, "state", 2);
  const primaryColorInput = optionalFormText(formData, "primaryColor", 20);
  const secondaryColorInput = optionalFormText(formData, "secondaryColor", 20);
  const state = stateInput ? parseAdminState(stateInput) : null;
  const primaryColor = primaryColorInput ? parseAdminColor(primaryColorInput) : null;
  const secondaryColor = secondaryColorInput ? parseAdminColor(secondaryColorInput) : null;
  const allowLocalPickup = checkbox(formData, "allowLocalPickup");
  const allowLocalDelivery = checkbox(formData, "allowLocalDelivery");
  if (email && !z.string().email().safeParse(email).success) throw new Error("INVALID_EMAIL");
  if (stateInput && !state) throw new Error("INVALID_STATE");
  if (primaryColorInput && !primaryColor) throw new Error("INVALID_PRIMARY_COLOR");
  if (secondaryColorInput && !secondaryColor) throw new Error("INVALID_SECONDARY_COLOR");
  if (!allowLocalPickup && !allowLocalDelivery) throw new Error("DELIVERY_METHOD_REQUIRED");
  const database = getDatabase();
  await database.$transaction([
    database.store.update({
      where: { id: session.storeId },
      data: {
        name: requiredText(formData, "name", 120),
        whatsapp: optionalFormText(formData, "whatsapp", 30),
        email,
        address: optionalFormText(formData, "address", 240),
        city: optionalFormText(formData, "city", 120),
        state,
      },
    }),
    database.storeSettings.upsert({
      where: { storeId: session.storeId },
      update: {
        allowLocalPickup,
        allowLocalDelivery,
        localDeliveryFeeCents,
        primaryColor,
        secondaryColor,
      },
      create: {
        storeId: session.storeId,
        allowLocalPickup,
        allowLocalDelivery,
        localDeliveryFeeCents,
        primaryColor,
        secondaryColor,
      },
    }),
  ]);
  revalidatePath("/admin/configuracoes");
  revalidatePath("/");
  redirect("/admin/configuracoes?saved=1");
}
