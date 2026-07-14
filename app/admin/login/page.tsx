import type { Metadata } from "next";
import Link from "next/link";
import { loginAdmin } from "../auth-actions";
import "../admin.css";

export const metadata: Metadata = { title: "Acesso da loja" };

const errorMessages: Record<string, string> = {
  invalid: "Revise o e-mail e a senha.",
  credentials: "E-mail ou senha não conferem.",
  unauthorized: "Esta conta não está vinculada a uma loja ativa.",
  "rate-limited": "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.",
  protection:
    "A proteção de acesso está temporariamente indisponível. Tente novamente em instantes.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="admin-login">
      <section className="admin-login-story" aria-label="Braga Commerce">
        <Link className="admin-wordmark" href="/">
          <span>BC</span>
          <strong>Braga Commerce</strong>
        </Link>
        <div>
          <p className="admin-kicker">Caderno de operação · PV Moda</p>
          <h1>
            A loja aberta.
            <br />A operação em ordem.
          </h1>
          <p>Produtos, estoque e pedidos em uma mesa de trabalho feita para o comércio local.</p>
        </div>
        <small>Área exclusiva para operadores autorizados.</small>
      </section>
      <section className="admin-login-panel">
        <form action={loginAdmin} className="admin-login-form">
          <p className="admin-index">Acesso / 01</p>
          <h2>Entre no painel</h2>
          <p>Use a conta administrativa vinculada à sua loja.</p>
          {error && errorMessages[error] ? (
            <div className="admin-alert error" role="alert">
              {errorMessages[error]}
            </div>
          ) : null}
          <label>
            <span>E-mail</span>
            <input
              autoComplete="email"
              name="email"
              placeholder="voce@loja.com.br"
              required
              type="email"
            />
          </label>
          <label>
            <span>Senha</span>
            <input
              autoComplete="current-password"
              minLength={8}
              name="password"
              required
              type="password"
            />
          </label>
          <button className="admin-button primary" type="submit">
            Entrar na operação <span>→</span>
          </button>
          <Link className="admin-back-link" href="/">
            ← Voltar para a vitrine
          </Link>
        </form>
      </section>
    </main>
  );
}
