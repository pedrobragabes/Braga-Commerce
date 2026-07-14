"use client";

export default function AdminPanelError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="admin-empty" role="alert">
      <span>!</span>
      <h2>Não foi possível carregar esta área</h2>
      <p>A operação não foi alterada. Tente novamente em alguns instantes.</p>
      <button className="admin-button primary" onClick={reset} type="button">
        Tentar novamente
      </button>
    </section>
  );
}
