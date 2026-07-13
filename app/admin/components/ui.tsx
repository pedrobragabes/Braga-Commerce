import type { ReactNode } from "react";

export function AdminPageHeader({
  index,
  eyebrow,
  title,
  description,
  action,
}: {
  index: string;
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="admin-page-header">
      <div className="admin-page-index">{index}</div>
      <div><p className="admin-kicker">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
      {action ? <div className="admin-page-action">{action}</div> : null}
    </header>
  );
}

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  WAITING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  FAILED: "Falhou",
  NOT_FULFILLED: "A separar",
  PREPARING: "Em preparação",
  READY_FOR_PICKUP: "Pronto para retirada",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
};

export function AdminStatus({ value }: { value: string }) {
  const tone = value === "PAID" || value === "CONFIRMED" || value === "DELIVERED"
    ? "positive"
    : value === "FAILED" || value === "CANCELLED" || value === "REFUNDED"
      ? "negative"
      : "neutral";
  return <span className={`admin-status ${tone}`}><i />{statusLabels[value] ?? value}</span>;
}

export function SavedNotice({ show, children = "Alterações salvas." }: { show: boolean; children?: ReactNode }) {
  return show ? <div className="admin-alert success" role="status">✓ {children}</div> : null;
}

export function EmptyAdminState({ title, description }: { title: string; description: string }) {
  return <div className="admin-empty"><span>＋</span><h2>{title}</h2><p>{description}</p></div>;
}
