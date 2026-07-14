import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acesso ao beta",
  robots: { index: false, follow: false, nocache: true },
};

export default async function BetaAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <main className="beta-access-page">
      <section className="beta-access-card">
        <span className="beta-access-mark" aria-hidden="true">PV</span>
        <p className="section-eyebrow">Vitrine em preparação</p>
        <h1>Acesso reservado ao beta.</h1>
        <p>
          A PV Moda ainda está em validação. Digite a senha compartilhada pelo
          responsável para visualizar a loja.
        </p>
        {erro === "1" ? (
          <div className="form-alert error" role="alert">Senha incorreta. Tente novamente.</div>
        ) : null}
        {erro === "config" ? (
          <div className="form-alert error" role="alert">
            O acesso beta está temporariamente indisponível.
          </div>
        ) : null}
        <form action="/api/beta-access" method="post">
          <label className="field">
            <span>Senha de acesso</span>
            <input
              autoComplete="current-password"
              maxLength={256}
              name="password"
              required
              type="password"
            />
          </label>
          <button className="primary-button full" type="submit">Entrar na vitrine</button>
        </form>
        <small>Pedidos e pagamentos ainda não estão abertos ao público.</small>
      </section>
    </main>
  );
}
