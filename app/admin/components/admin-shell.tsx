import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminSession } from "../../../lib/admin-auth";
import { visibleAdminSections } from "../../../lib/admin-rules";
import { logoutAdmin } from "../auth-actions";
import { canonicalStoreUrl } from "../../../lib/directory-bridge";

const marks: Record<string, string> = {
  "Visão geral": "01",
  Produtos: "02",
  Categorias: "03",
  Pedidos: "04",
  Relatórios: "05",
  Configurações: "06",
  Apresentação: "07",
  Integrações: "08",
};

export function AdminShell({ session, children }: { session: AdminSession; children: ReactNode }) {
  const storeUrl = canonicalStoreUrl({ domain: session.storeDomain ?? null, slug: session.storeSlug });
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-wordmark" href="/admin"><span>BC</span><strong>Braga Commerce</strong></Link>
        <div className="admin-store-card">
          <small>Operação ativa</small>
          <strong>{session.storeName}</strong>
          <span>{session.role}</span>
          <Link href="/admin/selecionar-loja">Trocar loja</Link>
        </div>
        <nav aria-label="Painel administrativo">
          {visibleAdminSections(session.role).map((section) => (
            <Link href={section.href} key={section.href}>
              <span>{marks[section.label]}</span>{section.label}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <p><strong>{session.name}</strong><span>{session.email}</span></p>
          <form action={logoutAdmin}><button type="submit">Sair</button></form>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div><span className="admin-live-dot" /> Sistema operacional</div>
          {storeUrl ? <a href={storeUrl} target="_blank" rel="noopener noreferrer">Ver vitrine ↗</a> : <Link href="/admin/tema/preview" target="_blank">Prévia da loja ↗</Link>}
        </header>
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
