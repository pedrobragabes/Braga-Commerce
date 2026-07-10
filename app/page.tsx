const milestones = ["Banco", "Seed", "Produtos públicos", "Carrinho", "Checkout", "Pagamento"];

export default function HomePage() {
  return (
    <main className="setup-shell">
      <section className="setup-card" aria-labelledby="setup-title">
        <p className="eyebrow">Milestone 0 · Fundação</p>
        <h1 id="setup-title">Braga Commerce</h1>
        <p className="lead">
          A base técnica da PV Moda Masculina está pronta para começar pelo fluxo que importa:
          produto, carrinho, checkout, pagamento e pedido.
        </p>
        <ol className="milestone-list">
          {milestones.map((milestone, index) => (
            <li key={milestone} className={index === 0 ? "current" : undefined}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {milestone}
            </li>
          ))}
        </ol>
        <p className="status">Próxima issue recomendada: #11 — criar o schema Prisma inicial.</p>
      </section>
    </main>
  );
}
