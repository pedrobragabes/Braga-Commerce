import { NextResponse } from "next/server";
import { CartQuoteError } from "../../../lib/cart-quote";
import { createPendingOrder } from "../../../lib/orders";
import { logEvent } from "../../../lib/observability/logger";
import { checkoutRequestSchema } from "../../../storefront/checkout/contracts";

export async function POST(request: Request) {
  const result = checkoutRequestSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Revise os dados informados.", fields: result.error.flatten().fieldErrors } },
      { status: 400 },
    );
  }

  try {
    const order = await createPendingOrder(result.data);
    return NextResponse.json({ orderId: order.id, status: order.status, totalCents: order.totalCents }, { status: 201 });
  } catch (error) {
    if (error instanceof CartQuoteError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    logEvent("error", "order.create.failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ error: { code: "ORDER_FAILED", message: "Não foi possível criar o pedido agora." } }, { status: 500 });
  }
}
