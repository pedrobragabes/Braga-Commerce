import { after, NextResponse } from "next/server";
import { CartQuoteError } from "../../../lib/cart-quote";
import { createPendingOrder, isCustomerIdentityError, isInventoryReservationError } from "../../../lib/orders";
import { getCustomerSession } from "../../../lib/customer-auth";
import { processEmailOutbox } from "../../../lib/email/outbox";
import { logEvent } from "../../../lib/observability/logger";
import { checkoutRequestSchema } from "../../../storefront/checkout/contracts";
import { enforceRateLimit, rateLimitPolicies } from "../../../lib/rate-limit";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, rateLimitPolicies.order);
  if (limited) return limited;
  const result = checkoutRequestSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Revise os dados informados.", fields: result.error.flatten().fieldErrors } },
      { status: 400 },
    );
  }

  try {
    const identity = await getCustomerSession();
    const order = await createPendingOrder(result.data, identity);
    after(async () => {
      try {
        const emailResult = await processEmailOutbox();
        logEvent("info", "order.email.trigger.completed", {
          result: emailResult.disabled ? "disabled" : `sent:${emailResult.sent}`,
        });
      } catch (emailError) {
        logEvent("error", "order.email.trigger.failed", {
          errorName: emailError instanceof Error ? emailError.name : "UnknownError",
        });
      }
    });
    return NextResponse.json({ orderId: order.id, status: order.status, totalCents: order.totalCents }, { status: 201 });
  } catch (error) {
    if (error instanceof CartQuoteError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    if (isInventoryReservationError(error)) {
      return NextResponse.json(
        { error: { code: "STOCK_CHANGED", message: (error as Error).message } },
        { status: 409 },
      );
    }
    if (isCustomerIdentityError(error)) {
      return NextResponse.json({ error: { code: "CUSTOMER_CONFLICT", message: (error as Error).message } }, { status: 409 });
    }
    logEvent("error", "order.create.failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ error: { code: "ORDER_FAILED", message: "Não foi possível criar o pedido agora." } }, { status: 500 });
  }
}
