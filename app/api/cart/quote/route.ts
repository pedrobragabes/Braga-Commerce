import { NextResponse } from "next/server";
import { CartQuoteError, quoteCart } from "../../../../lib/cart-quote";
import { logEvent } from "../../../../lib/observability/logger";
import { quoteRequestSchema } from "../../../../storefront/checkout/contracts";

export async function POST(request: Request) {
  const result = quoteRequestSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Carrinho inválido.", fields: result.error.flatten().fieldErrors } },
      { status: 400 },
    );
  }

  try {
    const quote = await quoteCart(result.data.storeSlug, result.data.items);
    return NextResponse.json({
      items: quote.items,
      subtotalCents: quote.subtotalCents,
      shippingCents: quote.shippingCents,
      totalCents: quote.totalCents,
      issues: quote.issues,
    });
  } catch (error) {
    if (error instanceof CartQuoteError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    logEvent("error", "cart.quote.failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ error: { code: "QUOTE_FAILED", message: "Não foi possível revisar o carrinho." } }, { status: 500 });
  }
}
