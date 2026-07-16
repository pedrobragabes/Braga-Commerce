const steps = ["Carrinho", "Dados e entrega", "Pedido"] as const;

export function CommerceProgress({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Etapas da compra" className="commerce-progress">
      {steps.map((label, index) => {
        const step = (index + 1) as 1 | 2 | 3;
        const state = step < current ? "complete" : step === current ? "current" : "upcoming";

        return (
          <li aria-current={state === "current" ? "step" : undefined} className={state} key={label}>
            <span>{String(step).padStart(2, "0")}</span>
            <strong>{label}</strong>
          </li>
        );
      })}
    </ol>
  );
}
