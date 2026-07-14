export const PRODUCT_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type ProductImageMimeType = (typeof PRODUCT_IMAGE_MIME_TYPES)[number];

// Mantém o corpo abaixo do limite de 4,5 MiB das funções da Vercel.
export const MAX_PRODUCT_IMAGE_BYTES = 4 * 1024 * 1024;

export function getStorageBucketName() {
  const bucket = (process.env.STORAGE_BUCKET || "product-images").trim();
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(bucket)) {
    throw new Error("STORAGE_BUCKET inválido.");
  }
  return bucket;
}
