"use server";
import { revalidatePath } from "next/cache";
import { getCustomerSession } from "../../lib/customer-auth";
import { getDatabase } from "../../lib/database";
import { acceptApplicationPlan, requestStore } from "../../lib/store-lifecycle";
import { headers } from "next/headers";
import { checkRateLimitIdentifier, getClientAddressFromHeaders, rateLimitPolicies } from "../../lib/rate-limit";

export async function submitApplication(_: { error?: string; success?: string }, form: FormData): Promise<{ error?: string; success?: string }> {
  const identity = await getCustomerSession();
  if (!identity) return { error: "Entre com sua conta confirmada para enviar a solicitação." };
  try {
    const rate = await checkRateLimitIdentifier(getClientAddressFromHeaders(await headers()), rateLimitPolicies.customerAuthIp);
    if (!rate.allowed) return { error: "Aguarde alguns minutos antes de tentar novamente." };
    const planId = String(form.get("planId") ?? "") || null;
    const plan = planId ? await getDatabase().plan.findFirst({ where: { id: planId, isPublished: true } }) : null;
    if (planId && (!plan || form.get("acceptTerms") !== "on")) return { error: "Leia e aceite as condições da versão escolhida." };
    if (form.get("applicationId")) {
      if (!planId) return { error: "Escolha uma proposta publicada." };
      await acceptApplicationPlan(identity.authUserId, String(form.get("applicationId")), planId);
    } else {
      await requestStore(identity, { requestKey: String(form.get("requestKey")), storeName: String(form.get("storeName") ?? ""),
        storeSlug: String(form.get("storeSlug") ?? ""), planId, acceptedPlanVersion: plan?.version ?? null });
    }
    revalidatePath("/solicitar-loja");
    return { success: "Solicitação registrada. A ativação depende de análise e das condições combinadas." };
  } catch { return { error: "Não foi possível registrar. Confira os dados e tente novamente." }; }
}
