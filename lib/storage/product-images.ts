import { getDatabase } from "../database";
import { getStorageBucketName } from "./config";
import { moveProductImageInOrder } from "./order";
import { requireMediaOperator } from "./deletion-outbox";
import type { Prisma } from "../../generated/prisma/client";
import { lockStore } from "../store-lifecycle";

async function getProductGallery(transaction: Prisma.TransactionClient, productId: string, storeId: string) {
  await transaction.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${productId} AND "storeId" = ${storeId} FOR UPDATE`;
  return transaction.product.findFirst({
    where: { id: productId, storeId },
    select: {
      id: true,
      slug: true,
      images: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true, storagePath: true, storageBucket: true },
      },
    },
  });
}

export async function moveStoredProductImage(input: {
  userId: string;
  storeId: string;
  productId: string;
  imageId: string;
  direction: "up" | "down";
}) {
  return getDatabase().$transaction(async (transaction) => {
    await requireMediaOperator(transaction, input);
    const product = await getProductGallery(transaction, input.productId, input.storeId);
    if (!product) throw new Error("PRODUCT_NOT_FOUND");
    const ordered = moveProductImageInOrder(product.images, input.imageId, input.direction);
    if (!ordered) throw new Error("IMAGE_NOT_FOUND");
    for (const [sortOrder, image] of ordered.entries()) await transaction.productImage.update({ where: { id: image.id }, data: { sortOrder } });
    return product;
  });
}

export async function removeStoredProductImage(input: {
  userId: string;
  storeId: string;
  productId: string;
  imageId: string;
}) {
  return getDatabase().$transaction(async (transaction) => {
    await requireMediaOperator(transaction, input);
    // Theme publication and deletion use the same store lock, so checking the
    // current draft/published images cannot race a new theme publication.
    await lockStore(transaction, input.storeId);
    const product = await getProductGallery(transaction, input.productId, input.storeId);
    if (!product) throw new Error("PRODUCT_NOT_FOUND");
    const image = product.images.find((item) => item.id === input.imageId);
    if (!image) {
      if (await transaction.storageDeletionJob.findFirst({ where: { imageId: input.imageId, storeId: input.storeId, productId: product.id, reason: "IMAGE_DELETED" } })) return product;
      throw new Error("IMAGE_NOT_FOUND");
    }
    const settings = await transaction.storeSettings.findUnique({ where: { storeId: input.storeId } });
    const versions = [settings?.themeDraftVersion, settings?.themePublishedVersion].filter((version): version is number => typeof version === "number");
    const themes = await transaction.storeThemeRevision.findMany({ where: { storeId: input.storeId, version: { in: versions } }, select: { content: true } });
    if (themes.some(({ content }) => content && typeof content === "object" && !Array.isArray(content)
      && (content.logoImageId === image.id || content.bannerImageId === image.id))) throw new Error("IMAGE_USED_BY_THEME");
    if (image.storagePath) {
      const bucket = image.storageBucket || getStorageBucketName();
      const job = { imageId: image.id, storeId: input.storeId, productId: product.id, actorId: input.userId,
        bucket, storagePath: image.storagePath, reason: "IMAGE_DELETED", status: "PENDING", attempts: 0,
        nextAttemptAt: new Date(), claimToken: null, lockedUntil: null, lastErrorCode: null, completedAt: null };
      await transaction.storageDeletionJob.upsert({ where: { bucket_storagePath: { bucket, storagePath: image.storagePath } }, create: job, update: job });
    }
    await transaction.productImage.delete({ where: { id: image.id } });
    for (const [sortOrder, item] of product.images.filter((item) => item.id !== image.id).entries()) {
      await transaction.productImage.update({ where: { id: item.id }, data: { sortOrder } });
    }
    await transaction.storeAuditEvent.create({ data: { storeId: input.storeId, actorId: input.userId, action: "PRODUCT_IMAGE_REMOVED", reference: image.id } });
    return product;
  });
}
