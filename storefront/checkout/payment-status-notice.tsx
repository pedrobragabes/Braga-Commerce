"use client";

import { useEffect, useState } from "react";
import { StoreIcon } from "../components/icons";

type PaymentStatus = "WAITING_PAYMENT" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
type ReturnHint = "success" | "pending" | "failure" | "unavailable" | null;

const statusCopy: Record<PaymentStatus, { title: string; description: string; tone: string }> = {
  WAITING_PAYMENT: {
    title: "Aguardando pagamento",
    description: "O pedido está salvo, mas ainda não recebemos uma confirmação segura do Mercado Pago.",
    tone: "waiting",
  },
  PAID: {
    title: "Pagamento confirmado",
    description: "O webhook foi validado e o pagamento foi confirmado diretamente com o provedor.",
    tone: "paid",
  },
  FAILED: {
    title: "Pagamento não aprovado",
    description: "O pedido continua salvo. Você pode iniciar uma nova tentativa de pagamento.",
    tone: "failed",
  },
  CANCELLED: {
    title: "Pagamento cancelado",
    description: "Nenhum pagamento foi confirmado para este pedido.",
    tone: "failed",
  },
  REFUNDED: {
    title: "Pagamento reembolsado",
    description: "O provedor informou que o valor deste pedido foi devolvido.",
    tone: "refunded",
  },
};

export function PaymentStatusNotice({
  orderId,
  initialStatus,
  returnHint,
}: {
  orderId: string;
  initialStatus: PaymentStatus;
  returnHint: ReturnHint;
}) {
  const [paymentStatus, setPaymentStatus] = useState(initialStatus);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (paymentStatus !== "WAITING_PAYMENT" || !returnHint || returnHint === "unavailable") return;
    let attempts = 0;
    const interval = window.setInterval(async () => {
      attempts += 1;
      try {
        const response = await fetch(`/api/orders/${orderId}/status`, { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json() as { paymentStatus: PaymentStatus };
          setPaymentStatus(payload.paymentStatus);
          if (payload.paymentStatus !== "WAITING_PAYMENT") window.clearInterval(interval);
        }
      } finally {
        if (attempts >= 6) window.clearInterval(interval);
      }
    }, 2_000);
    return () => window.clearInterval(interval);
  }, [orderId, paymentStatus, returnHint]);

  async function startPayment() {
    setRedirecting(true);
    setRetryError(null);
    try {
      const response = await fetch("/api/payments/mercadopago/preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Pagamento indisponível.");
      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : "Pagamento indisponível.");
      setRedirecting(false);
    }
  }

  const copy = paymentStatus === "WAITING_PAYMENT" && returnHint === "failure"
    ? { ...statusCopy.WAITING_PAYMENT, title: "Pagamento não concluído", description: "O retorno não confirma pagamento. Seu pedido continua salvo para uma nova tentativa." }
    : paymentStatus === "WAITING_PAYMENT" && returnHint === "success"
      ? { ...statusCopy.WAITING_PAYMENT, title: "Validando pagamento", description: "Você voltou do Mercado Pago. A confirmação final ainda depende do webhook assinado." }
      : paymentStatus === "WAITING_PAYMENT" && returnHint === "unavailable"
        ? { ...statusCopy.WAITING_PAYMENT, title: "Pagamento ainda não configurado", description: "O pedido foi salvo, mas a integração de pagamento ainda não está disponível neste ambiente." }
        : statusCopy[paymentStatus];

  return (
    <div className={`payment-notice ${copy.tone}`} aria-live="polite">
      <span><StoreIcon name={paymentStatus === "PAID" ? "check" : "shield"} size={21} /></span>
      <div><strong>{copy.title}</strong><p>{copy.description}</p></div>
      {(paymentStatus === "WAITING_PAYMENT" || paymentStatus === "FAILED") ? (
        <button disabled={redirecting} onClick={startPayment} type="button">
          {redirecting ? "Abrindo…" : "Pagar com Mercado Pago"}
        </button>
      ) : null}
      {retryError ? <p className="payment-error" role="alert">{retryError}</p> : null}
    </div>
  );
}
