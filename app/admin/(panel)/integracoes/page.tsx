import { requireAdminSession } from "../../../../lib/admin-auth";
import { getDatabase } from "../../../../lib/database";
import { BindingForm } from "./form";
export default async function IntegrationsPage() {
  const actor = await requireAdminSession("settings:write");
  const binding = await getDatabase().storeDirectoryBinding.findUnique({ where: { storeId: actor.storeId }, select: { commerceId: true, origin: true } });
  return <><h1>Vínculo com ComércioBES</h1><p>Identificador desta loja: <code>{actor.storeId}</code></p><BindingForm binding={binding} /></>;
}
