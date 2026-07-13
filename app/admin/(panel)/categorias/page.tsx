import { can, requireAdminSession } from "../../../../lib/admin-auth";
import { getDatabase } from "../../../../lib/database";
import { saveCategory } from "../../actions";
import { AdminPageHeader, SavedNotice } from "../../components/ui";

export default async function AdminCategoriesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const session = await requireAdminSession("catalog:read");
  const { saved } = await searchParams;
  const categories = await getDatabase().category.findMany({ where: { storeId: session.storeId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } });
  const editable = can(session.role, "catalog:write");
  return (
    <>
      <AdminPageHeader index="03" eyebrow="Arquitetura da vitrine" title="Categorias que orientam." description="Ordem e publicação refletem diretamente na navegação pública." />
      <SavedNotice show={Boolean(saved)} />
      <section className="admin-section category-list"><div className="admin-section-heading"><div><p className="admin-kicker">Navegação atual</p><h2>{categories.length} categorias</h2></div></div>
        {categories.map((category) => <form action={saveCategory} className="admin-inline-form category" key={category.id}><input name="categoryId" type="hidden" value={category.id} /><label><span>Nome</span><input defaultValue={category.name} disabled={!editable} name="name" required /></label><label><span>Slug</span><input defaultValue={category.slug} disabled={!editable} name="slug" /></label><label className="grow"><span>Descrição</span><input defaultValue={category.description ?? ""} disabled={!editable} name="description" /></label><label className="small"><span>Ordem</span><input defaultValue={category.sortOrder} disabled={!editable} name="sortOrder" type="number" /></label><label className="check"><input defaultChecked={category.isActive} disabled={!editable} name="isActive" type="checkbox" /> Ativa</label><span className="admin-count">{category._count.products} itens</span>{editable ? <button className="admin-button compact" type="submit">Salvar</button> : null}</form>)}
      </section>
      {editable ? <section className="admin-form-card"><div className="admin-card-heading"><div><p className="admin-kicker">Nova seção</p><h2>Adicionar categoria</h2></div></div><form action={saveCategory} className="admin-inline-form category new"><label><span>Nome *</span><input name="name" required /></label><label><span>Slug</span><input name="slug" placeholder="gerado pelo nome" /></label><label className="grow"><span>Descrição</span><input name="description" /></label><label className="small"><span>Ordem</span><input defaultValue="0" name="sortOrder" type="number" /></label><label className="check"><input defaultChecked name="isActive" type="checkbox" /> Ativa</label><button className="admin-button primary compact" type="submit">Adicionar</button></form></section> : null}
    </>
  );
}
