import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminSession } from "../../../lib/admin-auth";
import { visibleAdminSections } from "../../../lib/admin-rules";
import { logoutAdmin } from "../auth-actions";

const marks: Record<string, string> = {
  "Visão geral": "01",
  Produtos: "02",
  Categorias: "03",
  Pedidos: "04",
  Configurações: "05",
};

export function AdminShell({ session, children }: { session: AdminSession; children: ReactNode }) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-wordmark" href="/admin"><span>BC</span><strong>Braga Commerce</strong></Link>
        <div className="admin-store-card">
          <small>Operação ativa</small>
          <strong>{session.storeName}</strong>
          <span>{session.role}</span>
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
          <Link href="/" target="_blank">Ver vitrine ↗</Link>
        </header>
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
