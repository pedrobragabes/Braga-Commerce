import { NextResponse } from "next/server";
import { z } from "zod";
import { MercadoPagoIntegrationError } from "../../../../../lib/mercado-pago/config";
import { createOrderPreference } from "../../../../../lib/mercado-pago/preference";
import { logEvent } from "../../../../../lib/observability/logger";
import { enforceRateLimit, rateLimitPolicies } from "../../../../../lib/rate-limit";

const preferenceRequestSchema = z.object({ orderId: z.string().min(1) }).strict();

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, rateLimitPolicies.preference);
  if (limited) return limited;
  const result = preferenceRequestSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Pedido inválido." } },
      { status: 400 },
    );
  }

  try {
    const preference = await createOrderPreference(result.data.orderId);
    return NextResponse.json(preference);
  } catch (error) {
    if (error instanceof MercadoPagoIntegrationError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    logEvent("error", "mercado_pago.preference.failed", {
      orderId: result.data.orderId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: { code: "PREFERENCE_FAILED", message: "Não foi possível iniciar o pagamento agora." } },
      { status: 502 },
    );
  }
}
