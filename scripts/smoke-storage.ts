import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createStorageAdminClient } from "../lib/storage/admin";
import { getStorageBucketName } from "../lib/storage/config";
import { getSupabasePublicConfig } from "../lib/supabase/config";

async function main() {
  const bucket = getStorageBucketName();
  const path = `smoke/${randomUUID()}.png`;
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const { url, publishableKey } = getSupabasePublicConfig();
  const anonymous = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const admin = createStorageAdminClient();

  const anonymousAttempt = await anonymous.storage.from(bucket).upload(path, bytes, {
    contentType: "image/png",
    upsert: false,
  });
  if (!anonymousAttempt.error) {
    await admin.storage.from(bucket).remove([path]);
    throw new Error("O bucket aceitou escrita anônima.");
  }

  const upload = await admin.storage.from(bucket).upload(path, bytes, {
    contentType: "image/png",
    upsert: false,
  });
  if (upload.error) throw new Error("O upload técnico autenticado falhou.");

  try {
    const { data } = admin.storage.from(bucket).getPublicUrl(path);
    const response = await fetch(data.publicUrl, { cache: "no-store" });
    if (!response.ok || response.headers.get("content-type") !== "image/png") {
      throw new Error("A leitura pública controlada não foi confirmada.");
    }
  } finally {
    const cleanup = await admin.storage.from(bucket).remove([path]);
    if (cleanup.error) throw new Error("A limpeza do smoke de Storage falhou.");
  }

  console.info(JSON.stringify({ anonymousWriteBlocked: true, publicRead: true, cleaned: true }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falha no smoke de Storage.");
  process.exitCode = 1;
});
