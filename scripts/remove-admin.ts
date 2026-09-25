import "dotenv/config";
import { getDatabase } from "../lib/database";
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const slug = process.env.STORE_SLUG || process.env.SEED_STORE_SLUG;
  if (!email || !slug) throw new Error("Configure ADMIN_EMAIL e STORE_SLUG para remover o vínculo.");
  if (process.env.REMOVE_AUTH_IDENTITY === "true") throw new Error("Exclusão de identidade exige processo separado de retenção.");
  const database = getDatabase();
  try {
    const store = await database.store.findUniqueOrThrow({ where: { slug }, select: { id: true } });
    const operator = await database.user.findUniqueOrThrow({ where: { storeId_email: { storeId: store.id, email } }, select: { id: true } });
    await database.user.delete({ where: { id: operator.id } });
    console.info("Vínculo administrativo removido; identidade e outros vínculos preservados.");
  } finally { await database.$disconnect(); }
}
main().catch(() => { console.error("Não foi possível remover o vínculo. Confira a loja e o operador."); process.exitCode = 1; });
