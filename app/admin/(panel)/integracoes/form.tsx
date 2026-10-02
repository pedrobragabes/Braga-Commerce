"use client";
import { useActionState } from "react";
import { updateCatalogSharing, updateDirectoryBinding } from "./actions";
export function BindingForm({ binding }: { binding: { commerceId: number; origin: string } | null }) {
  const [state, action, pending] = useActionState(updateDirectoryBinding, {});
  return <form action={action} className="admin-form-card"><div className="admin-form-grid">
    <label><span>Identificador do estabelecimento no BES</span><input name="commerceId" type="number" min="1" defaultValue={binding?.commerceId} /></label>
    <label><span>Origem autorizada do ComércioBES</span><input name="origin" type="url" defaultValue={binding?.origin ?? ""} placeholder="https://comerciobes.com.br" /></label>
    <label className="wide"><span>Código único fornecido no painel do BES</span><input name="challenge" type="password" autoComplete="off" minLength={64} maxLength={64} /><small>O código não é exibido novamente nem armazenado em texto.</small></label>
  </div><p>Confirme que você administra o perfil correspondente. O vínculo só será exibido após verificação no BES.</p>
    <p role={state.error ? "alert" : "status"}>{state.error || state.success}</p>
    <button className="admin-button primary" name="operation" value="save" disabled={pending}>Registrar vínculo</button>
    {binding ? <button className="admin-button" name="operation" value="remove" disabled={pending}>Desativar vínculo</button> : null}
  </form>;
}

export function CatalogSharingForm({ enabled, revision, canEnable }: { enabled: boolean; revision: string; canEnable: boolean }) {
  const [state, action, pending] = useActionState(updateCatalogSharing, {});
  return <form action={action} className="admin-form-card">
    <h2>Produtos no Comércio BES</h2>
    <p>Mostre uma seleção de até 12 produtos no perfil do seu comércio. A compra continua nesta loja.</p>
    <p>{enabled ? "Você autorizou a exibição dos produtos." : "A exibição dos produtos está desativada."}</p>
    <input type="hidden" name="expectedRevision" value={revision} />
    {!enabled && canEnable ? <label><input type="checkbox" name="consent" required /> Autorizo mostrar os produtos, fotos, preços e disponibilidade no Comércio BES.</label> : null}
    {!enabled && !canEnable ? <p>O responsável pela loja precisa autorizar a exibição dos produtos.</p> : null}
    <p role={state.error ? "alert" : "status"}>{state.error || state.success}</p>
    {enabled ? <button className="admin-button" name="operation" value="disable" disabled={pending}>Parar de mostrar produtos</button>
      : canEnable ? <button className="admin-button primary" name="operation" value="enable" disabled={pending}>Autorizar produtos</button> : null}
  </form>;
}
