"use server";
import { revalidatePath } from "next/cache";
import { requireAdminAction } from "../../../../lib/admin-auth";
import { removeDirectoryBinding, saveDirectoryBinding } from "../../../../lib/directory-bridge";
import { setCatalogSharing } from "../../../../lib/catalog-sharing";
import { StoreLifecycleError } from "../../../../lib/store-lifecycle";

export async function updateDirectoryBinding(_: { error?: string; success?: string }, form: FormData): Promise<{ error?: string; success?: string }> {
  try {
    const actor = await requireAdminAction("settings:write");
    if (form.get("operation") === "remove") await removeDirectoryBinding(actor);
    else await saveDirectoryBinding(actor, { commerceId: Number(form.get("commerceId")), origin: String(form.get("origin") ?? ""), challenge: String(form.get("challenge") ?? "") });
    revalidatePath("/admin/integracoes");
    return { success: "Vínculo atualizado. Conclua a verificação no ComércioBES." };
  } catch { return { error: "Não foi possível salvar. Confira a loja, a origem autorizada e o código de verificação." }; }
}

export async function updateCatalogSharing(_: { error?: string; success?: string }, form: FormData): Promise<{ error?: string; success?: string }> {
  try {
    const actor = await requireAdminAction("settings:write");
    const operation = form.get("operation");
    if (operation !== "enable" && operation !== "disable" || operation === "enable" && form.get("consent") !== "on") return { error: "Confirme a autorização para mostrar os produtos." };
    await setCatalogSharing(actor, { enabled: operation === "enable", scopeVersion: 2,
      expectedRevision: String(form.get("expectedRevision") ?? "") });
    revalidatePath("/admin/integracoes");
    return { success: operation === "enable" ? "Produtos autorizados. Conclua também a autorização no Comércio BES." : "Exibição dos produtos desativada." };
  } catch (error) {
    if (error instanceof StoreLifecycleError && error.code === "DIRECTORY_BINDING_CHANGED") return { error: "O vínculo mudou. Atualize a página e tente novamente." };
    return { error: "Não foi possível alterar a autorização. Confira seu acesso e o vínculo com o Comércio BES." };
  }
}
