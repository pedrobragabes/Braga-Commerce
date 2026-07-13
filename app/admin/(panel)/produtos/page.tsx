import Link from "next/link";
import { can, requireAdminSession } from "../../../../lib/admin-auth";
import { getDatabase } from "../../../../lib/database";
import { formatCurrency } from "../../../../storefront/format";
import { toggleProduct } from "../../actions";
import { AdminPageHeader, EmptyAdminState } from "../../components/ui";

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireAdminSession("catalog:read");
  const { q } = await searchParams;
  const query = q?.trim();
  const products = await getDatabase().product.findMany({
    where: {
      storeId: session.storeId,
      ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { sku: { contains: query, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true, name: true, sku: true, basePriceCents: true, stockQuantity: true,
      hasVariants: true, isActive: true, category: { select: { name: true } },
      variants: { where: { isActive: true }, select: { stockQuantity: true } },
    },
  });
  const editable = can(session.role, "catalog:write");

  return (
    <>
      <AdminPageHeader index="02" eyebrow="Catálogo vivo" title="Produtos em ordem de venda." description="Preço, publicação e estoque sem perder o histórico dos pedidos." action={editable ? <Link className="admin-button primary" href="/admin/produtos/novo">＋ Novo produto</Link> : undefined} />
      <form className="admin-filter" method="get"><input defaultValue={query} name="q" placeholder="Buscar por nome ou SKU" /><button type="submit">Buscar</button>{query ? <Link href="/admin/produtos">Limpar</Link> : null}</form>
      {products.length ? (
        <div className="admin-table-wrap"><table className="admin-table products"><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Publicação</th><th /></tr></thead><tbody>{products.map((product) => {
          const stock = product.hasVariants ? product.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0) : product.stockQuantity;
          return <tr key={product.id}><td><Link href={`/admin/produtos/${product.id}`}><strong>{product.name}</strong><small>{product.sku || "Sem SKU"}</small></Link></td><td>{product.category?.name ?? "Sem categoria"}</td><td>{formatCurrency(product.basePriceCents)}</td><td><strong className={stock <= 3 ? "admin-stock-low" : ""}>{stock}</strong><small>{product.hasVariants ? `${product.variants.length} variações` : "produto simples"}</small></td><td><span className={`admin-publication ${product.isActive ? "active" : ""}`}>{product.isActive ? "Publicado" : "Rascunho"}</span></td><td><div className="admin-row-actions"><Link href={`/admin/produtos/${product.id}`}>Abrir</Link>{editable ? <form action={toggleProduct}><input name="productId" type="hidden" value={product.id} /><button type="submit">{product.isActive ? "Pausar" : "Publicar"}</button></form> : null}</div></td></tr>;
        })}</tbody></table></div>
      ) : <EmptyAdminState title="Nenhum produto encontrado" description={query ? "Tente outro termo de busca." : "Cadastre o primeiro item da coleção."} />}
    </>
  );
}
