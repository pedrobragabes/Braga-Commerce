import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { can, requireAdminSession } from "../../../../../lib/admin-auth";
import { getDatabase } from "../../../../../lib/database";
import { retryStorageCleanup, saveVariant, updateProduct } from "../../../actions";
import { AdminPageHeader, SavedNotice } from "../../../components/ui";
import { ProductImageManager } from "../../../components/product-image-manager";
import { StockAdjustmentForm } from "../../../components/stock-adjustment-form";

function decimal(cents: number | null) { return cents === null ? "" : (cents / 100).toFixed(2); }

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const session = await requireAdminSession("catalog:read");
  const { id } = await params;
  const { saved, error } = await searchParams;
  const database = getDatabase();
  const [product, categories, adjustments, cleanups] = await Promise.all([
    database.product.findFirst({ where: { id, storeId: session.storeId }, include: { images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }, variants: { orderBy: { name: "asc" } } } }),
    database.category.findMany({ where: { storeId: session.storeId }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    database.stockAdjustment.findMany({ where: { storeId: session.storeId, productId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
    database.storageDeletionJob.findMany({ where: { storeId: session.storeId, productId: id, status: { in: ["PENDING", "PROCESSING", "BLOCKED"] } }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, status: true, attempts: true } }),
  ]);
  if (!product) notFound();
  const editCatalog = can(session.role, "catalog:write");
  const editInventory = can(session.role, "inventory:write");

  return (
    <>
      <AdminPageHeader index="02.2" eyebrow={product.isActive ? "Produto publicado" : "Produto em rascunho"} title={product.name} description="Dados comerciais separados da operação de estoque." action={<Link className="admin-button ghost" href="/admin/produtos">← Produtos</Link>} />
      <SavedNotice show={Boolean(saved)} />
      {error === "image-theme" ? <p className="admin-alert" role="alert">Esta imagem está no tema publicado ou no rascunho. Substitua-a em Apresentação antes de remover.</p> : null}
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
              <label><span>Categoria</span><select defaultValue={product.categoryId ?? ""} name="categoryId"><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label className="wide"><span>Resumo</span><input defaultValue={product.shortDescription ?? ""} name="shortDescription" /></label>
              <label className="wide"><span>Descrição</span><textarea defaultValue={product.description ?? ""} name="description" rows={5} /></label>
            </div>
            <div className="admin-check-row"><label><input defaultChecked={product.isActive} name="isActive" type="checkbox" /> Publicado</label><label><input defaultChecked={product.isFeatured} name="isFeatured" type="checkbox" /> Destaque</label><span>{product.hasVariants ? "Estoque por variação" : "Estoque simples"}</span></div>
          </fieldset>
          {editCatalog ? <div className="admin-form-footer"><p>Pedidos antigos mantêm seus snapshots.</p><button className="admin-button primary" type="submit">Salvar ficha →</button></div> : null}
        </form>
        <aside className="admin-rail-note"><span>Estoque</span><p>Salvar a ficha não altera quantidades. Entradas e saídas são registradas separadamente, com motivo.</p></aside>
      </section>

      {!product.hasVariants && editInventory ? <section className="admin-form-card"><h2>Ajustar estoque disponível</h2><StockAdjustmentForm productId={product.id} quantity={product.stockQuantity} requestId={randomUUID()} /></section> : null}

      <ProductImageManager canEdit={can(session.role, "images:write")} images={product.images} productId={product.id} productName={product.name} />
      {cleanups.length && can(session.role, "images:write") ? <section className="admin-form-card"><h2>Limpeza de arquivos</h2><p>As imagens removidas já saíram da galeria. A exclusão do arquivo é retomada automaticamente em caso de falha.</p>{cleanups.map((job) => <div key={job.id}><p>{job.status === "BLOCKED" ? "Limpeza precisa de nova tentativa após conferir o armazenamento." : "Limpeza aguardando processamento."} · Tentativas: {job.attempts}</p>{job.status === "BLOCKED" ? <form action={retryStorageCleanup}><input type="hidden" name="jobId" value={job.id} /><button className="admin-button compact" type="submit">Solicitar nova tentativa</button></form> : null}</div>)}</section> : null}

      <section className="admin-section">
        <div className="admin-section-heading"><div><p className="admin-kicker">Grade e disponibilidade</p><h2>Variações</h2></div><span>{product.variants.length} cadastrada(s)</span></div>
        {product.variants.map((variant) => (
          <div className="admin-variant-card" key={variant.id}><form action={saveVariant} className="admin-inline-form variant">
            <input name="productId" type="hidden" value={product.id} /><input name="variantId" type="hidden" value={variant.id} />
            <label><span>Nome</span><input defaultValue={variant.name} disabled={!editCatalog} name="name" required /></label>
            <label><span>SKU</span><input defaultValue={variant.sku ?? ""} disabled={!editCatalog} name="sku" /></label>
            <label><span>Tamanho</span><input defaultValue={variant.size ?? ""} disabled={!editCatalog} name="size" /></label>
            <label><span>Cor</span><input defaultValue={variant.color ?? ""} disabled={!editCatalog} name="color" /></label>
            <label><span>Preço próprio</span><input defaultValue={decimal(variant.priceCents)} disabled={!editCatalog} min="0" name="price" step="0.01" type="number" /></label>
            <label className="check"><input defaultChecked={variant.isActive} disabled={!editCatalog} name="isActive" type="checkbox" /> Ativa</label>
            {editCatalog ? <button className="admin-button compact" type="submit">Salvar ficha</button> : null}
          </form>{editInventory && product.hasVariants ? <StockAdjustmentForm productId={product.id} variantId={variant.id} quantity={variant.stockQuantity} requestId={randomUUID()} /> : null}</div>
        ))}
        {editCatalog && product.hasVariants ? <form action={saveVariant} className="admin-inline-form variant new"><input name="productId" type="hidden" value={product.id} /><label><span>Nova variação</span><input name="name" placeholder="Ex.: Preto / M" required /></label><label><span>SKU</span><input name="sku" /></label><label><span>Tamanho</span><input name="size" /></label><label><span>Cor</span><input name="color" /></label><label><span>Preço próprio</span><input min="0" name="price" step="0.01" type="number" /></label><label className="check"><input defaultChecked name="isActive" type="checkbox" /> Ativa</label><button className="admin-button compact primary" type="submit">Adicionar</button></form> : null}
      </section>
      <section className="admin-section"><h2>Últimos ajustes</h2>{adjustments.length ? <ul className="admin-stock-history">{adjustments.map((entry) => <li key={entry.id}><strong>{entry.quantityBefore} → {entry.quantityAfter}</strong> · {entry.reason}<small>{entry.createdAt.toLocaleString("pt-BR")} · operador {entry.actorId.slice(-7)}{entry.variantId ? ` · variação ${product.variants.find((variant) => variant.id === entry.variantId)?.name ?? entry.variantId.slice(-7)}` : ""}</small></li>)}</ul> : <p>Nenhum ajuste manual registrado.</p>}</section>
    </>
  );
}
