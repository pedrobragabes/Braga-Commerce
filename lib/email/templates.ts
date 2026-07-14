import type { EmailType } from "../../generated/prisma/client";

type TemplateOrder = {
  id: string;
  customerName: string;
  totalCents: number;
  deliveryMethod: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

const copy: Record<EmailType, { subject: string; title: string; message: string }> = {
  ORDER_CREATED: {
    subject: "Recebemos seu pedido",
    title: "Pedido recebido",
    message: "Seu pedido foi criado e o estoque está reservado temporariamente enquanto aguardamos o pagamento.",
  },
  PAYMENT_CONFIRMED: {
    subject: "Pagamento confirmado",
    title: "Pagamento confirmado",
    message: "O pagamento foi confirmado. A loja seguirá com a preparação do pedido.",
  },
  ORDER_CANCELLED: {
    subject: "Pedido cancelado",
    title: "Pedido cancelado",
    message: "O pedido foi cancelado e a reserva de estoque foi liberada.",
  },
  PAYMENT_REFUNDED: {
    subject: "Reembolso registrado",
    title: "Reembolso registrado",
    message: "O reembolso foi registrado. O prazo de crédito depende do meio de pagamento e da instituição financeira.",
  },
};

export function renderOrderEmail(type: EmailType, order: TemplateOrder, storeName: string, orderUrl: string) {
  const content = copy[type];
  const safeName = escapeHtml(order.customerName);
  const safeStore = escapeHtml(storeName);
  const shortId = order.id.slice(-7).toUpperCase();
  const subject = `${content.subject} · #${shortId}`;
  const text = `${content.title}\n\nOlá, ${order.customerName}. ${content.message}\n\nPedido: #${shortId}\nTotal: ${money(order.totalCents)}\nAcompanhe: ${orderUrl}\n\n${storeName}`;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f1ea;color:#172019;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:32px 20px"><div style="background:#fff;padding:32px;border-radius:16px"><p style="margin:0 0 24px;color:#687067;font-size:12px;text-transform:uppercase;letter-spacing:.12em">${safeStore}</p><h1 style="margin:0 0 16px;font-family:Georgia,serif">${escapeHtml(content.title)}</h1><p>Olá, ${safeName}. ${escapeHtml(content.message)}</p><p><strong>Pedido:</strong> #${shortId}<br><strong>Total:</strong> ${money(order.totalCents)}</p><p style="margin-top:28px"><a href="${escapeHtml(orderUrl)}" style="background:#315b3c;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Acompanhar pedido</a></p></div></div></body></html>`;
  return { subject, text, html };
}
