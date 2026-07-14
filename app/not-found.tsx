import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <div className="not-found-card">
        <p className="section-eyebrow">Erro 404</p>
        <span aria-hidden="true">PV</span>
        <h1>Essa peça saiu da vitrine.</h1>
        <p>A página não existe mais ou o endereço foi digitado incorretamente.</p>
        <div>
          <Link className="primary-button" href="/produtos">Ver produtos</Link>
          <Link className="secondary-button" href="/">Voltar ao início</Link>
        </div>
      </div>
    </main>
  );
}
