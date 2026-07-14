import { InvalidWebhookSignatureError } from "mercadopago";
import { NextResponse } from "next/server";
import { z } from "zod";
import { MercadoPagoIntegrationError } from "../../../../lib/mercado-pago/config";
import { logEvent } from "../../../../lib/observability/logger";
import {
  processMercadoPagoPayment,
  validateMercadoPagoWebhookSignature,
} from "../../../../lib/mercado-pago/webhook";

const webhookSchema = z
  .object({
    action: z.string().max(100).optional(),
    type: z.string().min(1).max(50),
    data: z.object({
      id: z.union([
        z.string().regex(/^\d{1,32}$/),
        z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      ]),
    }),
  })
  .passthrough();

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const dataId = requestUrl.searchParams.get("data.id");
  const requestId = request.headers.get("x-request-id");

  if (!dataId || !/^\d{1,32}$/.test(dataId) || (requestId?.length ?? 0) > 200) {
    return NextResponse.json({ error: { code: "DATA_ID_MISSING" } }, { status: 400 });
  }

  try {
    validateMercadoPagoWebhookSignature({
      signature: request.headers.get("x-signature"),
      requestId,
      dataId,
    });
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      logEvent("warn", "mercado_pago.webhook.invalid_signature", {
        requestId,
        reason: error.reason,
      });
      return NextResponse.json({ error: { code: "INVALID_SIGNATURE" } }, { status: 401 });
    }
    if (error instanceof MercadoPagoIntegrationError) {
      return NextResponse.json({ error: { code: error.code } }, { status: error.status });
    }
    throw error;
  }

  const parsedBody = webhookSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success || String(parsedBody.data.data.id) !== dataId) {
    return NextResponse.json({ error: { code: "INVALID_NOTIFICATION" } }, { status: 400 });
  }
  if (parsedBody.data.type !== "payment") {
    logEvent("info", "mercado_pago.webhook.ignored", { requestId, type: parsedBody.data.type });
    return NextResponse.json({ received: true, result: "IGNORED_TYPE" }, { status: 202 });
  }

  try {
    const outcome = await processMercadoPagoPayment(
      dataId,
      requestId,
      parsedBody.data.action ?? parsedBody.data.type,
    );
    logEvent("info", "mercado_pago.webhook.processed", {
      requestId,
      paymentId: dataId,
      orderId: outcome.orderId,
      providerStatus: outcome.providerStatus,
      result: outcome.result,
    });
    return NextResponse.json({ received: true, result: outcome.result });
  } catch (error) {
    logEvent("error", "mercado_pago.webhook.failed", {
      requestId,
      paymentId: dataId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ error: { code: "WEBHOOK_PROCESSING_FAILED" } }, { status: 502 });
  }
}
