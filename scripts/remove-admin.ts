import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { getDatabase } from "../lib/database";
import { getSupabasePublicConfig, getSupabaseServiceRoleKey } from "../lib/supabase/config";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("Configure ADMIN_EMAIL para remover um operador.");

  const database = getDatabase();
  const operator = await database.user.findUnique({
    where: { email },
    select: { id: true, authUserId: true },
  });
  if (!operator) throw new Error("Operador administrativo não encontrado.");

  if (operator.authUserId) {
    const { url } = getSupabasePublicConfig();
    const supabase = createClient(url, getSupabaseServiceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await supabase.auth.admin.deleteUser(operator.authUserId);
    if (error) throw new Error(error.message);
  }
  await database.user.delete({ where: { id: operator.id } });
  console.info("Operador administrativo removido do Auth e do Prisma.");
  await database.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
