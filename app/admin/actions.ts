"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminAction } from "../../lib/admin-auth";
import {
  parseAdminInteger,
  parseAdminMoney,
  parseAdminState,
  slugifyAdminValue,
} from "../../lib/admin-rules";
import { getDatabase } from "../../lib/database";
import { moveStoredProductImage, removeStoredProductImage } from "../../lib/storage/product-images";
import { adjustAvailableStock, StockAdjustmentError } from "../../lib/admin-inventory";
import { saveOrderOperation } from "../../lib/admin-order-operation";
import { InventoryReviewError, resolveOrderInventory } from "../../lib/order-inventory-review";
import { retryImageCleanup } from "../../lib/storage/deletion-outbox";

const idSchema = z.string().min(1).max(80);

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
  if (!slug) throw new Error("INVALID_SLUG");

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
      stockQuantity: 0,
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
  if (!slug) throw new Error("INVALID_PRODUCT");

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
  const product = await moveStoredProductImage({ userId: session.userId, storeId: session.storeId, productId, imageId, direction });
  revalidatePath(`/admin/produtos/${product.id}`);
  revalidatePath(`/produto/${product.slug}`);
}

export async function removeProductImage(formData: FormData) {
  const session = await requireAdminAction("images:write");
  const productId = idSchema.parse(formData.get("productId"));
  const imageId = idSchema.parse(formData.get("imageId"));
  let product;
  try { product = await removeStoredProductImage({ userId: session.userId, storeId: session.storeId, productId, imageId }); }
  catch (error) {
    if (error instanceof Error && error.message === "IMAGE_USED_BY_THEME") redirect(`/admin/produtos/${productId}?error=image-theme`);
    throw error;
  }
  revalidatePath(`/admin/produtos/${product.id}`);
  revalidatePath(`/produto/${product.slug}`);
}

export async function retryStorageCleanup(formData: FormData) {
  const session = await requireAdminAction("images:write");
  const jobId = idSchema.parse(formData.get("jobId"));
  await retryImageCleanup(session, jobId);
  revalidatePath("/admin/produtos", "layout");
}

export async function saveVariant(formData: FormData) {
  const session = await requireAdminAction("catalog:write");
  const productId = idSchema.parse(formData.get("productId"));
  const variantId = optionalFormText(formData, "variantId", 80);
  const product = await getDatabase().product.findFirst({ where: { id: productId, storeId: session.storeId } });
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  if (!product.hasVariants) throw new Error("PRODUCT_WITHOUT_VARIANTS");
  const data = {
    name: requiredText(formData, "name", 120),
    sku: optionalFormText(formData, "sku", 80),
    size: optionalFormText(formData, "size", 40),
    color: optionalFormText(formData, "color", 60),
    priceCents: formData.get("price") ? money(formData, "price") : null,
    isActive: checkbox(formData, "isActive"),
  };
  const database = getDatabase();
  if (variantId) {
    const variant = await database.productVariant.findFirst({ where: { id: variantId, productId: product.id } });
    if (!variant) throw new Error("VARIANT_NOT_FOUND");
    await database.productVariant.update({ where: { id: variant.id }, data });
  } else {
    await database.productVariant.create({ data: { productId: product.id, ...data, stockQuantity: 0 } });
  }
  revalidatePath(`/admin/produtos/${product.id}`);
  revalidatePath(`/produto/${product.slug}`);
  redirect(`/admin/produtos/${product.id}?saved=variant`);
}

export async function adjustStock(_previous: { error?: string; success?: boolean }, formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const session = await requireAdminAction("inventory:write");
  const productId = idSchema.parse(formData.get("productId"));
  try {
    await adjustAvailableStock(session, {
      productId,
      variantId: optionalFormText(formData, "variantId", 80),
      expectedQuantity: Number(formData.get("expectedQuantity")),
      delta: Number(formData.get("delta")),
      reason: String(formData.get("reason") ?? ""),
      requestId: String(formData.get("requestId") ?? ""),
    });
  } catch (error) {
    if (error instanceof StockAdjustmentError || error instanceof z.ZodError) {
      revalidatePath(`/admin/produtos/${productId}`);
      return { error: error instanceof StockAdjustmentError && error.code === "STOCK_CONFLICT"
        ? "O saldo mudou. Confira a quantidade atualizada e refaça o ajuste."
        : "Ajuste inválido. Informe uma quantidade diferente de zero e um motivo; o saldo não pode ficar negativo." };
    }
    throw error;
  }
  revalidatePath(`/admin/produtos/${productId}`);
  revalidatePath("/produtos");
  return { success: true };
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
  ]).parse(formData.get("fulfillmentStatus"));
  try {
    await saveOrderOperation(session, {
      orderId, fulfillmentStatus: nextStatus, internalNote: String(formData.get("internalNote") ?? ""),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_READY") {
      redirect(`/admin/pedidos/${orderId}?error=not-ready`);
    }
    throw error;
  }
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${orderId}`);
  redirect(`/admin/pedidos/${orderId}?saved=1`);
}

export async function resolveInventoryReview(_previous: { error?: string; success?: boolean }, formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const session = await requireAdminAction("orders:write");
  const orderId = idSchema.parse(formData.get("orderId"));
  try {
    await resolveOrderInventory(session, {
      orderId, requestId: String(formData.get("requestId") ?? ""),
      expectedVersion: Number(formData.get("expectedVersion")),
      action: formData.get("resolution"), reason: formData.get("reason"),
    });
  } catch (error) {
    if (error instanceof InventoryReviewError || error instanceof z.ZodError) {
      revalidatePath(`/admin/pedidos/${orderId}`);
      const messages: Record<string, string> = {
        FORBIDDEN: "Somente o proprietário ou administrador pode resolver esta revisão.",
        INSUFFICIENT_STOCK: "Não há saldo disponível para todos os itens. Nenhuma unidade foi debitada. Confira a reposição ou cancele o atendimento e encaminhe o estorno ao provedor.",
        ORDER_CHANGED: "O pedido mudou. Confira os dados atualizados e refaça a decisão.",
        REVIEW_NOT_OPEN: "Esta revisão não está aberta para decisão. Confira pagamento e atendimento atuais.",
        IDEMPOTENCY_CONFLICT: "Esta tentativa já foi usada com outra decisão. Recarregue antes de tentar novamente.",
      };
      return { error: error instanceof InventoryReviewError ? messages[error.code] ?? "Pedido não encontrado nesta loja." : "Informe uma decisão e um motivo entre 5 e 500 caracteres." };
    }
    return { error: "Não foi possível confirmar a decisão. Reenvie a mesma tentativa para consultar seu resultado com segurança." };
  }
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/produtos");
  return { success: true };
}

export async function updateStoreSettings(formData: FormData) {
  const session = await requireAdminAction("settings:write");
  const localDeliveryFeeCents = money(formData, "localDeliveryFee");
  const email = optionalFormText(formData, "email", 160);
  const stateInput = optionalFormText(formData, "state", 2);
  const state = stateInput ? parseAdminState(stateInput) : null;
  const allowLocalPickup = checkbox(formData, "allowLocalPickup");
  const allowLocalDelivery = checkbox(formData, "allowLocalDelivery");
  if (email && !z.string().email().safeParse(email).success) throw new Error("INVALID_EMAIL");
  if (stateInput && !state) throw new Error("INVALID_STATE");
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
      },
      create: {
        storeId: session.storeId,
        allowLocalPickup,
        allowLocalDelivery,
        localDeliveryFeeCents,
      },
    }),
  ]);
  revalidatePath("/admin/configuracoes");
  revalidatePath("/");
  redirect("/admin/configuracoes?saved=1");
}
