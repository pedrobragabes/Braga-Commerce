import "dotenv/config";
import { getDatabase } from "../lib/database";
import { createStorageAdminClient } from "../lib/storage/admin";
import {
  getStorageBucketName,
  MAX_PRODUCT_IMAGE_BYTES,
  PRODUCT_IMAGE_MIME_TYPES,
} from "../lib/storage/config";

async function main() {
  const bucket = getStorageBucketName();
  const storage = createStorageAdminClient();
  const database = getDatabase();
  try {
    const { data: buckets, error: listError } = await storage.storage.listBuckets();
    if (listError) throw new Error("Não foi possível consultar os buckets do Storage.");

    const options = {
      public: true,
      fileSizeLimit: MAX_PRODUCT_IMAGE_BYTES,
      allowedMimeTypes: [...PRODUCT_IMAGE_MIME_TYPES],
    };
    const operation = buckets.some((item) => item.id === bucket)
      ? storage.storage.updateBucket(bucket, options)
      : storage.storage.createBucket(bucket, options);
    const { error: bucketError } = await operation;
    if (bucketError) throw new Error("Não foi possível configurar o bucket de imagens.");

    // A escrita acontece exclusivamente com service role após RBAC na API.
    // Não criamos políticas INSERT/UPDATE/DELETE para anon ou authenticated.
    await database.$executeRawUnsafe(
      `DROP POLICY IF EXISTS "Public read product images" ON storage.objects`,
    );
    await database.$executeRawUnsafe(
      `CREATE POLICY "Public read product images" ON storage.objects
       FOR SELECT TO public USING (bucket_id = '${bucket}')`,
    );

    const policies = await database.$queryRawUnsafe<Array<{ policyname: string; cmd: string }>>(
      `SELECT policyname, cmd FROM pg_policies
       WHERE schemaname = 'storage' AND tablename = 'objects'
         AND policyname = 'Public read product images'`,
    );
    if (policies.length !== 1 || policies[0]?.cmd !== "SELECT") {
      throw new Error("A política de leitura do Storage não foi confirmada.");
    }

    console.info(
      JSON.stringify({
        bucket,
        publicRead: true,
        publicWrite: false,
        maxBytes: MAX_PRODUCT_IMAGE_BYTES,
      }),
    );
  } finally {
    await database.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falha ao configurar o Storage.");
  process.exitCode = 1;
});
