import type { Metadata } from "next";
import { requirePlatformSession } from "../../lib/platform-auth";
import { getDatabase } from "../../lib/database";
import { OperationForm } from "./operation-form";
import "../admin/admin.css";
export const metadata: Metadata = { title: "Operação comercial", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  await requirePlatformSession();
  const database = getDatabase();
  const [applications, subscriptions, plans] = await Promise.all([
    database.storeApplication.findMany({ where: { status: "REQUESTED" }, include: { plan: true }, orderBy: { createdAt: "asc" }, take: 100 }),
    database.subscription.findMany({ include: { store: true, plan: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    database.plan.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  return <main className="admin-content"><h1>Operação comercial assistida</h1><p>Condições e direito de uso da loja virtual. Nenhuma ação aqui cobra cartão ou confirma pagamentos de compradores.</p>
    <h2>Condições comerciais</h2><p>Crie uma nova versão para qualquer alteração. Preço em branco significa não definido; não representa gratuidade.</p>
    <OperationForm label="Registrar versão do plano"><input name="operation" type="hidden" value="plan" /><div className="admin-form-grid">
      <label><span>Código</span><input name="code" required pattern="[a-z0-9-]{2,50}" /></label><label><span>Versão</span><input name="version" type="number" min="1" required /></label><label><span>Nome</span><input name="name" maxLength={100} required /></label>
      <label><span>Preço em centavos (opcional)</span><input name="priceCents" type="number" min="0" /></label><label className="wide"><span>Condições, período e suporte acordados</span><textarea name="conditions" minLength={20} maxLength={10000} required /></label>
      <label><input name="checkoutEnabled" type="checkbox" />Permite novas compras durante a vigência</label><label><input name="isPublished" type="checkbox" />Condições revisadas e disponíveis para aceite</label>
    </div></OperationForm>
    <ul>{plans.map((plan) => <li key={plan.id}>{plan.name} — versão {plan.version} — {plan.isPublished ? "disponível para aceite" : "não publicado"}</li>)}</ul>
    <h2>Solicitações</h2>{!applications.length ? <p>Nenhuma solicitação pendente.</p> : applications.map((request) => <OperationForm key={request.id} label="Provisionar com condições aceitas">
      <h3>{request.storeName}</h3><p>Endereço: {request.storeSlug}. {request.plan ? `${request.plan.name}, versão ${request.acceptedPlanVersion}` : "Aguardando proposta e aceite."}</p>
      <input name="operation" type="hidden" value="provision" /><input name="applicationId" type="hidden" value={request.id} />
    </OperationForm>)}
    {applications.map((request) => <OperationForm key={`reject:${request.id}`} label="Rejeitar solicitação com motivo">
      <h3>Revisar {request.storeName}</h3><input name="operation" type="hidden" value="reject" /><input name="applicationId" type="hidden" value={request.id} /><label><span>Motivo da não aprovação</span><input name="reason" minLength={5} maxLength={500} required /></label>
    </OperationForm>)}
    <h2>Vigência e acesso</h2><p>Datas em UTC. Cancelar bloqueia novas compras imediatamente e preserva pedidos existentes. Encerrar ao final mantém acesso até o fim do período.</p>
    {subscriptions.map((subscription) => <OperationForm key={`${subscription.id}:${subscription.revision}`} label="Registrar alteração de acesso">
      <h3>{subscription.store.name}</h3><p>{subscription.plan.name} — {subscription.status}</p><input name="operation" type="hidden" value="subscription" /><input name="storeId" type="hidden" value={subscription.storeId} /><input name="expectedRevision" type="hidden" value={subscription.revision} />
      <div className="admin-form-grid"><label><span>Estado</span><select name="status" defaultValue={subscription.status}><option value="PENDING">Pendente</option><option value="ACTIVE">Ativo</option><option value="ENDING">Encerrar ao fim</option><option value="CANCELLED">Cancelado agora</option><option value="SUSPENDED">Suspenso</option></select></label>
      <label><span>Origem da concessão</span><select name="activationOrigin" defaultValue={subscription.activationOrigin ?? ""}><option value="">Ainda não concedido</option><option value="ADMINISTRATIVE">Liberação administrativa (sem pagamento)</option><option value="COURTESY">Cortesia (sem pagamento)</option><option value="EXTERNAL_CONFIRMATION">Pagamento confirmado externamente</option></select></label>
      <label><span>Início (UTC)</span><input name="startsAt" defaultValue={subscription.startsAt?.toISOString() ?? ""} placeholder="AAAA-MM-DDTHH:mm:ssZ" /></label><label><span>Fim (UTC)</span><input name="endsAt" defaultValue={subscription.endsAt?.toISOString() ?? ""} placeholder="AAAA-MM-DDTHH:mm:ssZ" /></label>
      <label><span>Referência técnica (sem dados pessoais)</span><input name="confirmationReference" maxLength={120} defaultValue={subscription.confirmationReference ?? ""} /></label><label><span>Motivo</span><input name="reason" minLength={5} maxLength={500} required /></label></div>
    </OperationForm>)}
    <h2>Domínios aprovados</h2><p>A configuração do servidor deve autorizar o hostname. Cadastre somente após conferir autorização do titular, DNS e HTTPS; isso não provisiona DNS automaticamente.</p>
    {subscriptions.map((subscription) => <OperationForm key={`domain:${subscription.id}`} label="Atribuir domínio aprovado"><h3>{subscription.store.name}</h3><input name="operation" type="hidden" value="domain" /><input name="storeId" type="hidden" value={subscription.storeId} /><label><span>Hostname (sem https://)</span><input name="domain" defaultValue={subscription.store.domain ?? ""} required maxLength={253} /></label><label><input name="verified" type="checkbox" required />Conferi autorização, DNS e HTTPS deste domínio.</label></OperationForm>)}
  </main>;
}
