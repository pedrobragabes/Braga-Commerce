import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "../../../../../lib/database";
import { pvModaConfig } from "../../../../../storefront/config/pv-moda";
import { enforceRateLimit, rateLimitPolicies } from "../../../../../lib/rate-limit";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(request, rateLimitPolicies.orderStatus);
  if (limited) return limited;
  const parsedId = z
    .string()
    .min(1)
    .max(80)
    .safeParse((await params).id);
  if (!parsedId.success) {
    return NextResponse.json({ error: { code: "INVALID_ORDER_ID" } }, { status: 400 });
  }
  const id = parsedId.data;
  const order = await getDatabase().order.findFirst({
    where: { id, store: { slug: pvModaConfig.storeSlug } },
    select: { status: true, paymentStatus: true, updatedAt: true },
  });
  if (!order) return NextResponse.json({ error: { code: "ORDER_NOT_FOUND" } }, { status: 404 });
  return NextResponse.json(order);
}
