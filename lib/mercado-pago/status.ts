export type InternalPaymentStatus = "WAITING_PAYMENT" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
export type InternalOrderStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "REFUNDED";

export type PaymentTransition = {
  paymentStatus: InternalPaymentStatus;
  orderStatus: InternalOrderStatus;
};

const pendingStatuses = new Set(["pending", "in_process", "in_mediation", "authorized"]);

export function mapMercadoPagoStatus(status: string): PaymentTransition | null {
  if (status === "approved") return { paymentStatus: "PAID", orderStatus: "CONFIRMED" };
  if (pendingStatuses.has(status)) return { paymentStatus: "WAITING_PAYMENT", orderStatus: "PENDING" };
  if (status === "rejected") return { paymentStatus: "FAILED", orderStatus: "PENDING" };
  if (status === "cancelled") return { paymentStatus: "CANCELLED", orderStatus: "CANCELLED" };
  if (status === "refunded" || status === "charged_back") {
    return { paymentStatus: "REFUNDED", orderStatus: "REFUNDED" };
  }
  return null;
}

export function shouldApplyPaymentTransition(
  currentStatus: InternalPaymentStatus,
  nextStatus: InternalPaymentStatus,
  samePayment: boolean,
) {
  if (currentStatus === "REFUNDED") return false;
  if (currentStatus === "PAID") return nextStatus === "REFUNDED";
  if (samePayment && (currentStatus === "FAILED" || currentStatus === "CANCELLED") && nextStatus === "WAITING_PAYMENT") {
    return false;
  }
  return currentStatus !== nextStatus;
}

export function buildPaymentEventKey(paymentId: string, providerStatus: string) {
  return `mercadopago:${paymentId}:${providerStatus}`;
}
