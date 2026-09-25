"use client";
import { useActionState } from "react";
import { resolveInventoryReview } from "../actions";

export function InventoryReviewForm({ orderId, version, requestId, allowCommit = true }: { orderId: string; version: number; requestId: string; allowCommit?: boolean }) {
  const [state, action, pending] = useActionState(resolveInventoryReview, {});
  return <form action={action} className="admin-stack-form">
    <input type="hidden" name="orderId" value={orderId} />
    <input type="hidden" name="expectedVersion" value={version} />
    <input type="hidden" name="requestId" value={requestId} />
    <label><span>Resolver estoque pendente</span><select name="resolution" required disabled={pending} defaultValue="">
      <option value="" disabled>Selecione uma decisão</option>
      {allowCommit ? <option value="COMMIT_STOCK">Conferi os itens: debitar saldo e liberar preparação</option> : null}
      <option value="CANCEL_FULFILLMENT">Cancelar atendimento e encaminhar estorno ao provedor</option>
    </select></label>
    <label><span>Motivo e conferência realizada</span><textarea name="reason" minLength={5} maxLength={500} required rows={3} disabled={pending} /></label>
    <p>O débito só acontece se houver saldo para todos os itens. Cancelar não devolve dinheiro: confira o pagamento no provedor e contate o cliente.</p>
    {state.error ? <p className="admin-alert" role="alert">{state.error}</p> : null}
    {state.success ? <p className="admin-alert success" role="status">Decisão registrada com auditoria.</p> : null}
    <button className="admin-button primary" disabled={pending || state.success} type="submit">{pending ? "Conferindo e registrando…" : "Registrar decisão"}</button>
  </form>;
}
