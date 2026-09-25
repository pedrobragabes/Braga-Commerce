import { requireAdminSession } from "../../../../lib/admin-auth";
import { getDatabase } from "../../../../lib/database";
import { getStorePresentation } from "../../../../lib/store-theme";
import { AdminPageHeader } from "../../components/ui";
import { ThemeEditor } from "./editor";

export default async function ThemePage() {
  const session = await requireAdminSession("settings:write");
  const database = getDatabase();
  const [{ content, store }, revisions, images] = await Promise.all([
    getStorePresentation(session.storeId, session),
    database.storeThemeRevision.findMany({ where: { storeId: session.storeId }, select: { version: true }, orderBy: { version: "desc" } }),
    database.productImage.findMany({ where: { product: { storeId: session.storeId } }, select: { id: true, alt: true } }),
  ]);
  return <><AdminPageHeader index="07" eyebrow="Apresentação" title="A identidade da sua loja." description="Edite, confira e publique com histórico de versões." />
    <ThemeEditor key={store.settings?.themeVersion ?? 0} content={content} version={store.settings?.themeVersion ?? 0} draftVersion={store.settings?.themeDraftVersion ?? null}
      publishedVersion={store.settings?.themePublishedVersion ?? null} revisions={revisions.map((revision) => revision.version)} images={images} /></>;
}
