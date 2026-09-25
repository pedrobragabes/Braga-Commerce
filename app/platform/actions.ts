"use server";
import { revalidatePath } from "next/cache";
import { requirePlatformSession } from "../../lib/platform-auth";
import { createPlanVersion, provisionStore, changeSubscription, StoreLifecycleError, rejectStoreApplication, assignStoreDomain } from "../../lib/store-lifecycle";
import { z } from "zod";

export async function operateStore(_: { error?: string; success?: string }, form: FormData): Promise<{ error?: string; success?: string }> {
  const identity = await requirePlatformSession();
  const value = (field: string) => String(form.get(field) ?? "");
  try {
    if (value("operation") === "plan") {
      await createPlanVersion(identity.authUserId, { code: value("code"), version: Number(value("version")), name: value("name"),
        conditions: value("conditions"), priceCents: value("priceCents") ? Number(value("priceCents")) : null,
        isPublished: form.get("isPublished") === "on", checkoutEnabled: form.get("checkoutEnabled") === "on" });
    } else if (value("operation") === "provision") {
      await provisionStore(identity.authUserId, value("applicationId"));
    } else if (value("operation") === "reject") {
      await rejectStoreApplication(identity.authUserId, value("applicationId"), value("reason"));
    } else if (value("operation") === "domain") {
      if (form.get("verified") !== "on") return { error: "Confirme a verificação de domínio e DNS antes de atribuir." };
      await assignStoreDomain(identity.authUserId, value("storeId"), value("domain"));
    } else if (value("operation") === "subscription") {
      await changeSubscription(identity.authUserId, { storeId: value("storeId"), expectedRevision: Number(value("expectedRevision")), status: value("status"),
        startsAt: value("startsAt") ? new Date(value("startsAt")) : null, endsAt: value("endsAt") ? new Date(value("endsAt")) : null,
        activationOrigin: value("activationOrigin") || null, confirmationReference: value("confirmationReference") || null, reason: value("reason") });
    } else return { error: "Operação inválida." };
    revalidatePath("/platform");
    return { success: "Operação registrada." };
  } catch (error) {
    return { error: error instanceof z.ZodError ? error.issues[0].message
      : error instanceof StoreLifecycleError ? ({ SLUG_IN_USE: "Este endereço já pertence a outra loja.", TERMS_REQUIRED: "O responsável precisa aceitar as condições publicadas.", SUBSCRIPTION_CHANGED: "A assinatura mudou. Atualize antes de continuar." }[error.code] || "Não foi possível concluir esta operação.")
      : "Não foi possível concluir. Confira os dados e atualize a página." };
  }
}
