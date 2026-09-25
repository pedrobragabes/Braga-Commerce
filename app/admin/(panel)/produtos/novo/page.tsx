import Link from "next/link";
import { requireAdminSession } from "../../../../../lib/admin-auth";
import { getDatabase } from "../../../../../lib/database";
import { createProduct } from "../../../actions";
import { AdminPageHeader } from "../../../components/ui";

export default async function NewProductPage() {
  const session = await requireAdminSession("catalog:write");
  const categories = await getDatabase().category.findMany({ where: { storeId: session.storeId }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <AdminPageHeader index="02.1" eyebrow="Nova entrada" title="Cadastrar produto." description="Salve a ficha e depois adicione fotos e registre o estoque disponível." action={<Link className="admin-button ghost" href="/admin/produtos">← Voltar</Link>} />
      <form action={createProduct} className="admin-form-card admin-product-form">
        <div className="admin-form-grid">
          <label className="wide"><span>Nome *</span><input name="name" required /></label>
          <label><span>Slug</span><input name="slug" placeholder="gerado pelo nome" /></label>
          <label><span>SKU</span><input name="sku" /></label>
          <label><span>Preço *</span><input min="0" name="basePrice" required step="0.01" type="number" /></label>
          <label><span>Categoria</span><select name="categoryId"><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className="wide"><span>Resumo</span><input maxLength={240} name="shortDescription" /></label>
          <label className="wide"><span>Descrição</span><textarea name="description" rows={5} /></label>
        </div>
        <div className="admin-check-row"><label><input name="isActive" type="checkbox" /> Publicar agora</label><label><input name="isFeatured" type="checkbox" /> Destacar na vitrine</label><label><input name="hasVariants" type="checkbox" /> Terá tamanho/cor</label></div>
        <div className="admin-form-footer"><p>O produto começa com saldo zero. Escolha agora se haverá variações; depois registre o estoque de cada item com motivo.</p><button className="admin-button primary" type="submit">Salvar produto →</button></div>
      </form>
    </>
  );
}
