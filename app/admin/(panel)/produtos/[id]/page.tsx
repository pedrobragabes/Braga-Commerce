import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireAdminSession } from "../../../../../lib/admin-auth";
import { getDatabase } from "../../../../../lib/database";
import { saveVariant, updateProduct } from "../../../actions";
import { AdminPageHeader, SavedNotice } from "../../../components/ui";

function decimal(cents: number | null) { return cents === null ? "" : (cents / 100).toFixed(2); }

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const session = await requireAdminSession("catalog:read");
  const { id } = await params;
  const { saved } = await searchParams;
  const database = getDatabase();
  const [product, categories] = await Promise.all([
    database.product.findFirst({ where: { id, storeId: session.storeId }, include: { variants: { orderBy: { name: "asc" } } } }),
    database.category.findMany({ where: { storeId: session.storeId }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!product) notFound();
  const editCatalog = can(session.role, "catalog:write");
  const editInventory = can(session.role, "inventory:write");

  return (
    <>
      <AdminPageHeader index="02.2" eyebrow={product.isActive ? "Produto publicado" : "Produto em rascunho"} title={product.name} description="Dados comerciais separados da operação de estoque." action={<Link className="admin-button ghost" href="/admin/produtos">← Produtos</Link>} />
      <SavedNotice show={Boolean(saved)} />
      <section className="admin-split-layout">
        <form action={updateProduct} className="admin-form-card admin-product-form">
          <input name="productId" type="hidden" value={product.id} />
          <div className="admin-card-heading"><div><p className="admin-kicker">Ficha comercial</p><h2>Informações do produto</h2></div><span>{editCatalog ? "Editável" : "Somente leitura"}</span></div>
          <fieldset disabled={!editCatalog}>
            <div className="admin-form-grid">
              <label className="wide"><span>Nome *</span><input defaultValue={product.name} name="name" required /></label>
              <label><span>Slug</span><input defaultValue={product.slug} name="slug" /></label>
              <label><span>SKU</span><input defaultValue={product.sku ?? ""} name="sku" /></label>
              <label><span>Preço *</span><input defaultValue={decimal(product.basePriceCents)} min="0" name="basePrice" required step="0.01" type="number" /></label>
              <label><span>Preço anterior</span><input defaultValue={decimal(product.compareAtCents)} min="0" name="compareAt" step="0.01" type="number" /></label>
              <label><span>Estoque simples</span><input defaultValue={product.stockQuantity} min="0" name="stockQuantity" step="1" type="number" /></label>
              <label><span>Categoria</span><select defaultValue={product.categoryId ?? ""} name="categoryId"><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label className="wide"><span>Resumo</span><input defaultValue={product.shortDescription ?? ""} name="shortDescription" /></label>
              <label className="wide"><span>Descrição</span><textarea defaultValue={product.description ?? ""} name="description" rows={5} /></label>
            </div>
            <div className="admin-check-row"><label><input defaultChecked={product.isActive} name="isActive" type="checkbox" /> Publicado</label><label><input defaultChecked={product.isFeatured} name="isFeatured" type="checkbox" /> Destaque</label><label><input defaultChecked={product.hasVariants} name="hasVariants" type="checkbox" /> Usa variações</label></div>
          </fieldset>
          {editCatalog ? <div className="admin-form-footer"><p>Pedidos antigos mantêm seus snapshots.</p><button className="admin-button primary" type="submit">Salvar ficha →</button></div> : null}
        </form>
        <aside className="admin-rail-note"><span>Regra / estoque</span><p>{product.hasVariants ? "A disponibilidade pública vem da soma das opções ativas." : "Produto simples usa o estoque informado na ficha e não pede escolha de variação."}</p></aside>
      </section>

      <section className="admin-section">
        <div className="admin-section-heading"><div><p className="admin-kicker">Grade e disponibilidade</p><h2>Variações</h2></div><span>{product.variants.length} cadastrada(s)</span></div>
        {product.variants.map((variant) => (
          <form action={saveVariant} className="admin-inline-form variant" key={variant.id}>
            <input name="productId" type="hidden" value={product.id} /><input name="variantId" type="hidden" value={variant.id} />
            <label><span>Nome</span><input defaultValue={variant.name} disabled={!editInventory} name="name" required /></label>
            <label><span>SKU</span><input defaultValue={variant.sku ?? ""} disabled={!editInventory} name="sku" /></label>
            <label><span>Tamanho</span><input defaultValue={variant.size ?? ""} disabled={!editInventory} name="size" /></label>
            <label><span>Cor</span><input defaultValue={variant.color ?? ""} disabled={!editInventory} name="color" /></label>
            <label><span>Preço próprio</span><input defaultValue={decimal(variant.priceCents)} disabled={!editInventory} min="0" name="price" step="0.01" type="number" /></label>
            <label><span>Estoque</span><input defaultValue={variant.stockQuantity} disabled={!editInventory} min="0" name="stockQuantity" required step="1" type="number" /></label>
            <label className="check"><input defaultChecked={variant.isActive} disabled={!editInventory} name="isActive" type="checkbox" /> Ativa</label>
            {editInventory ? <button className="admin-button compact" type="submit">Salvar</button> : null}
          </form>
        ))}
        {editInventory ? <form action={saveVariant} className="admin-inline-form variant new"><input name="productId" type="hidden" value={product.id} /><label><span>Nova variação</span><input name="name" placeholder="Ex.: Preto / M" required /></label><label><span>SKU</span><input name="sku" /></label><label><span>Tamanho</span><input name="size" /></label><label><span>Cor</span><input name="color" /></label><label><span>Preço próprio</span><input min="0" name="price" step="0.01" type="number" /></label><label><span>Estoque</span><input defaultValue="0" min="0" name="stockQuantity" required step="1" type="number" /></label><label className="check"><input defaultChecked name="isActive" type="checkbox" /> Ativa</label><button className="admin-button compact primary" type="submit">Adicionar</button></form> : null}
      </section>
    </>
  );
}
