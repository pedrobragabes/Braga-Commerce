import type { ReactNode } from "react";
import Link from "next/link";

export function AuthCard({ eyebrow, title, description, children, aside }: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="account-auth-page">
      <div className="store-container account-auth-grid">
        <div className="account-auth-story">
          <span className="account-auth-monogram">PV</span>
          <p className="section-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="account-auth-promise">
            <strong>Sua compra, no seu ritmo.</strong>
            <span>O cadastro é opcional e o checkout como convidado continua disponível.</span>
          </div>
        </div>
        <div className="account-auth-card">
          {children}
          {aside ? <div className="account-auth-aside">{aside}</div> : null}
          <Link className="account-back-link" href="/">← Voltar para a vitrine</Link>
        </div>
      </div>
    </section>
  );
}

export function AuthMessage({ kind = "error", children }: { kind?: "error" | "success"; children: ReactNode }) {
  return <div className={`form-alert ${kind}`} role={kind === "error" ? "alert" : "status"}>{children}</div>;
}
