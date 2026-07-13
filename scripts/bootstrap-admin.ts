import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { getDatabase } from "../lib/database";
import { getSupabasePublicConfig, getSupabaseServiceRoleKey } from "../lib/supabase/config";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrador PV Moda";
  const storeSlug = process.env.SEED_STORE_SLUG || "pv-moda-masculina";
  const role = process.env.ADMIN_ROLE || "OWNER";

  if (!email || !password || password.length < 12) {
    throw new Error("Configure ADMIN_EMAIL e ADMIN_PASSWORD com ao menos 12 caracteres.");
  }
  if (role !== "OWNER" && role !== "ADMIN" && role !== "STAFF") {
    throw new Error("ADMIN_ROLE deve ser OWNER, ADMIN ou STAFF.");
  }

  const database = getDatabase();
  const store = await database.store.findUnique({ where: { slug: storeSlug }, select: { id: true } });
  if (!store) throw new Error(`Loja ${storeSlug} não encontrada. Execute o seed primeiro.`);

  const { url } = getSupabasePublicConfig();
  const supabase = createClient(url, getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error || !data.user) throw new Error(error?.message || "Não foi possível criar a identidade.");

  try {
    await database.user.upsert({
      where: { email },
      update: { authUserId: data.user.id, storeId: store.id, name, role, isActive: true },
      create: { authUserId: data.user.id, storeId: store.id, name, email, role },
    });
    console.info(`Operador ${email} criado para ${storeSlug} com role ${role}.`);
  } catch (error) {
    await supabase.auth.admin.deleteUser(data.user.id);
    throw error;
  } finally {
    await database.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
