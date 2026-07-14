import {
  MAX_PRODUCT_IMAGE_BYTES,
  PRODUCT_IMAGE_MIME_TYPES,
  type ProductImageMimeType,
} from "./config";

const extensions: Record<ProductImageMimeType, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class ProductImageValidationError extends Error {
  constructor(
    public readonly code: "EMPTY_FILE" | "FILE_TOO_LARGE" | "UNSUPPORTED_TYPE" | "TYPE_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "ProductImageValidationError";
  }
}

function hasBytes(bytes: Uint8Array, offset: number, signature: number[]) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

export function detectProductImageMimeType(bytes: Uint8Array): ProductImageMimeType | null {
  if (hasBytes(bytes, 0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (
    hasBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46]) &&
    hasBytes(bytes, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }
  return null;
}

export async function readValidatedProductImage(file: File) {
  if (file.size === 0) {
    throw new ProductImageValidationError("EMPTY_FILE", "Selecione uma imagem não vazia.");
  }
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    throw new ProductImageValidationError("FILE_TOO_LARGE", "A imagem deve ter no máximo 4 MiB.");
  }
  if (!PRODUCT_IMAGE_MIME_TYPES.includes(file.type as ProductImageMimeType)) {
    throw new ProductImageValidationError("UNSUPPORTED_TYPE", "Envie uma imagem JPG, PNG ou WebP.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedType = detectProductImageMimeType(bytes);
  if (!detectedType || detectedType !== file.type) {
    throw new ProductImageValidationError(
      "TYPE_MISMATCH",
      "O conteúdo do arquivo não corresponde ao formato informado.",
    );
  }

  return { bytes, contentType: detectedType, extension: extensions[detectedType] };
}
