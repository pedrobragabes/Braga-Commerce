import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { can, getAdminSession } from "../../../lib/admin-auth";
import { getDatabase } from "../../../lib/database";
import { createStorageAdminClient } from "../../../lib/storage/admin";
import { getStorageBucketName } from "../../../lib/storage/config";
import {
  ProductImageValidationError,
  readValidatedProductImage,
} from "../../../lib/storage/validation";

const idSchema = z.string().min(1).max(80);
const altSchema = z.string().trim().max(160);

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return errorResponse(401, "AUTH_REQUIRED", "Entre no painel para enviar imagens.");
  if (!can(session.role, "images:write")) {
    return errorResponse(403, "FORBIDDEN", "Seu perfil não pode alterar imagens do catálogo.");
  }

  try {
    const formData = await request.formData();
    const productId = idSchema.parse(formData.get("productId"));
    const altValue = altSchema.parse(String(formData.get("alt") ?? ""));
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return errorResponse(400, "FILE_REQUIRED", "Selecione uma imagem para enviar.");
    }

    const database = getDatabase();
    const product = await database.product.findFirst({
      where: { id: productId, storeId: session.storeId },
      select: { id: true },
    });
    if (!product) return errorResponse(404, "PRODUCT_NOT_FOUND", "Produto não encontrado.");

    const image = await readValidatedProductImage(file);
    const bucket = getStorageBucketName();
    const storagePath = `${session.storeId}/${product.id}/${randomUUID()}.${image.extension}`;
    const storage = createStorageAdminClient();
    const { error: uploadError } = await storage.storage
      .from(bucket)
      .upload(storagePath, image.bytes, {
        cacheControl: "31536000",
        contentType: image.contentType,
        upsert: false,
      });
    if (uploadError) {
      return errorResponse(502, "STORAGE_UPLOAD_FAILED", "O Storage não concluiu o envio.");
    }

    const { data: publicUrl } = storage.storage.from(bucket).getPublicUrl(storagePath);
    try {
      const highestOrder = await database.productImage.aggregate({
        where: { productId: product.id },
        _max: { sortOrder: true },
      });
      const record = await database.productImage.create({
        data: {
          productId: product.id,
          url: publicUrl.publicUrl,
          storagePath,
          alt: altValue || null,
          sortOrder: (highestOrder._max.sortOrder ?? -1) + 1,
        },
        select: { id: true, url: true, alt: true, sortOrder: true },
      });
      return NextResponse.json({ url: record.url, image: record }, { status: 201 });
    } catch {
      await storage.storage.from(bucket).remove([storagePath]);
      return errorResponse(
        500,
        "IMAGE_PERSISTENCE_FAILED",
        "A imagem não pôde ser vinculada ao produto.",
      );
    }
  } catch (error) {
    if (error instanceof ProductImageValidationError) {
      return errorResponse(400, error.code, error.message);
    }
    if (error instanceof z.ZodError) {
      return errorResponse(400, "INVALID_INPUT", "Os dados do upload são inválidos.");
    }
    return errorResponse(500, "UPLOAD_FAILED", "Não foi possível processar a imagem.");
  }
}
