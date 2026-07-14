import { getDatabase } from "../database";
import { createStorageAdminClient } from "./admin";
import { getStorageBucketName } from "./config";
import { moveProductImageInOrder } from "./order";

async function getProductGallery(productId: string, storeId: string) {
  return getDatabase().product.findFirst({
    where: { id: productId, storeId },
    select: {
      id: true,
      slug: true,
      images: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true, storagePath: true },
      },
    },
  });
}

export async function moveStoredProductImage(input: {
  storeId: string;
  productId: string;
  imageId: string;
  direction: "up" | "down";
}) {
  const product = await getProductGallery(input.productId, input.storeId);
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  const ordered = moveProductImageInOrder(product.images, input.imageId, input.direction);
  if (!ordered) throw new Error("IMAGE_NOT_FOUND");
  await getDatabase().$transaction(
    ordered.map((image, sortOrder) =>
      getDatabase().productImage.update({ where: { id: image.id }, data: { sortOrder } }),
    ),
  );
  return product;
}

export async function removeStoredProductImage(input: {
  storeId: string;
  productId: string;
  imageId: string;
}) {
  const product = await getProductGallery(input.productId, input.storeId);
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  const image = product.images.find((item) => item.id === input.imageId);
  if (!image) throw new Error("IMAGE_NOT_FOUND");

  if (image.storagePath) {
    const { error } = await createStorageAdminClient()
      .storage.from(getStorageBucketName())
      .remove([image.storagePath]);
    if (error) throw new Error("STORAGE_REMOVE_FAILED");
  }

  const remaining = product.images.filter((item) => item.id !== image.id);
  await getDatabase().$transaction([
    getDatabase().productImage.delete({ where: { id: image.id } }),
    ...remaining.map((item, sortOrder) =>
      getDatabase().productImage.update({ where: { id: item.id }, data: { sortOrder } }),
    ),
  ]);
  return product;
}
