"use client";
import { useActionState } from "react";
import { submitApplication } from "./actions";
export function ApplicationForm({ requestKey, applicationId, plans }: { requestKey: string; applicationId?: string; plans: Array<{ id: string; name: string; version: number; conditions: string }> }) {
  const [state, action, pending] = useActionState(submitApplication, {});
  return <form action={action} className="admin-form-card">
    <input name="requestKey" type="hidden" value={requestKey} />{applicationId ? <input name="applicationId" type="hidden" value={applicationId} /> : <div className="admin-form-grid">
      <label><span>Nome da loja</span><input name="storeName" maxLength={100} required /></label>
      <label><span>Endereço curto desejado</span><input name="storeSlug" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={70} minLength={2} required placeholder="minha-loja" /><small>Letras minúsculas, números e hífens.</small></label>
    </div>}
    <label><span>Proposta comercial</span><select name="planId" required={Boolean(applicationId)}><option value="">Solicitar análise, sem aceitar condições ainda</option>{plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name} — versão {plan.version}</option>)}</select></label>
    {plans.map((plan) => <details key={plan.id}><summary>{plan.name} — condições da versão {plan.version}</summary><p style={{ whiteSpace: "pre-wrap" }}>{plan.conditions}</p></details>)}
    {plans.length ? <label><input name="acceptTerms" type="checkbox" />Li e aceito as condições da proposta escolhida.</label> : <p>As condições comerciais ainda serão definidas. Esta solicitação não gera cobrança nem ativa uma assinatura.</p>}
    <p role={state.error ? "alert" : "status"}>{state.error || state.success}</p><button className="admin-button primary" disabled={pending}>{pending ? "Enviando…" : applicationId ? "Aceitar proposta" : "Solicitar minha loja virtual"}</button>
  </form>;
}
