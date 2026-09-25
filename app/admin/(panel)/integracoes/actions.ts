"use server";
import { revalidatePath } from "next/cache";
import { requireAdminAction } from "../../../../lib/admin-auth";
import { removeDirectoryBinding, saveDirectoryBinding } from "../../../../lib/directory-bridge";

export async function updateDirectoryBinding(_: { error?: string; success?: string }, form: FormData): Promise<{ error?: string; success?: string }> {
  try {
    const actor = await requireAdminAction("settings:write");
    if (form.get("operation") === "remove") await removeDirectoryBinding(actor);
    else await saveDirectoryBinding(actor, { commerceId: Number(form.get("commerceId")), origin: String(form.get("origin") ?? ""), challenge: String(form.get("challenge") ?? "") });
    revalidatePath("/admin/integracoes");
    return { success: "Vínculo atualizado. Conclua a verificação no ComércioBES." };
  } catch { return { error: "Não foi possível salvar. Confira a loja, a origem autorizada e o código de verificação." }; }
}
