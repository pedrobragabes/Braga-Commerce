import { requireAdminSession } from "../../../../lib/admin-auth";
import { getDatabase } from "../../../../lib/database";
import { updateStoreSettings } from "../../actions";
import { AdminPageHeader, SavedNotice } from "../../components/ui";

function decimal(cents: number | null | undefined) { return ((cents ?? 0) / 100).toFixed(2); }

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const session = await requireAdminSession("settings:write");
  const { saved } = await searchParams;
  const store = await getDatabase().store.findUnique({ where: { id: session.storeId }, include: { settings: true } });
  if (!store) return null;
  return (
    <>
      <AdminPageHeader index="06" eyebrow="Identidade operacional" title="Ajustes da loja." description="Contato e modalidades isolados por loja. Credenciais de pagamento não passam por este painel." />
      <SavedNotice show={Boolean(saved)} />
      <form action={updateStoreSettings} className="admin-form-card admin-settings-form">
        <div className="admin-card-heading"><div><p className="admin-kicker">Dados públicos</p><h2>Contato e endereço</h2></div><span>{store.slug}</span></div>
        <div className="admin-form-grid"><label className="wide"><span>Nome da loja *</span><input defaultValue={store.name} name="name" required /></label><label><span>WhatsApp</span><input defaultValue={store.whatsapp ?? ""} name="whatsapp" /></label><label><span>E-mail</span><input defaultValue={store.email ?? ""} name="email" type="email" /></label><label className="wide"><span>Endereço</span><input defaultValue={store.address ?? ""} name="address" /></label><label><span>Cidade</span><input defaultValue={store.city ?? ""} name="city" /></label><label><span>UF</span><input defaultValue={store.state ?? ""} maxLength={2} minLength={2} name="state" pattern="[A-Za-z]{2}" /></label></div>
        <hr />
        <div className="admin-card-heading"><div><p className="admin-kicker">Atendimento</p><h2>Entrega e retirada</h2></div></div>
        <div className="admin-check-row cards"><label><input defaultChecked={store.settings?.allowLocalPickup ?? true} name="allowLocalPickup" type="checkbox" /><span><strong>Retirada local</strong><small>Cliente combina a retirada na loja.</small></span></label><label><input defaultChecked={store.settings?.allowLocalDelivery ?? false} name="allowLocalDelivery" type="checkbox" /><span><strong>Entrega local</strong><small>Ativa endereço no checkout.</small></span></label></div>
        <div className="admin-form-grid compact"><label><span>Taxa de entrega</span><input defaultValue={decimal(store.settings?.localDeliveryFeeCents)} min="0" name="localDeliveryFee" required step="0.01" type="number" /></label><label><span>Cor principal proposta</span><input defaultValue={store.settings?.primaryColor ?? "#284d3b"} name="primaryColor" pattern="^#[0-9A-Fa-f]{6}$" /></label><label><span>Cor secundária proposta</span><input defaultValue={store.settings?.secondaryColor ?? "#d66a2f"} name="secondaryColor" pattern="^#[0-9A-Fa-f]{6}$" /></label></div>
        <div className="admin-alert">As cores ficam salvas como proposta, mas a vitrine atual continua usando a identidade visual versionada. A aplicação automática depende de preview, contraste e rollback.</div>
        <div className="admin-security-note"><strong>Pagamento protegido</strong><p>Tokens e secrets do Mercado Pago continuam exclusivos do ambiente do servidor e não são editáveis aqui.</p></div>
        <div className="admin-form-footer"><p>Contato, endereço e entrega aparecem na próxima renderização. As cores ainda não são aplicadas automaticamente.</p><button className="admin-button primary" type="submit">Salvar configurações →</button></div>
      </form>
    </>
  );
}
