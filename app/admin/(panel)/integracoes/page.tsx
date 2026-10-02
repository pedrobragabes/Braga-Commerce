import { requireAdminSession } from "../../../../lib/admin-auth";
import { getDatabase } from "../../../../lib/database";
import { BindingForm, CatalogSharingForm } from "./form";
import { catalogConsentCurrent } from "../../../../lib/catalog-sharing";
export default async function IntegrationsPage() {
  const actor = await requireAdminSession("settings:write");
  const database = getDatabase();
  const binding = await database.storeDirectoryBinding.findUnique({ where: { storeId: actor.storeId } });
  const owner = binding?.catalogConsentActorId ? await database.user.findFirst({ where: { id: binding.catalogConsentActorId, storeId: actor.storeId } }) : null;
  return <><h1>Vínculo com Comércio BES</h1><p>Identificador desta loja: <code>{actor.storeId}</code></p>
    <BindingForm binding={binding ? { commerceId: binding.commerceId, origin: binding.origin } : null} />
    {binding ? <CatalogSharingForm enabled={catalogConsentCurrent(binding, owner)} revision={binding.catalogConsentRevision} canEnable={actor.role === "OWNER"} /> : null}
  </>;
}
