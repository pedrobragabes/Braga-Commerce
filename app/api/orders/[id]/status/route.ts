import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "../../../../../lib/database";
import { matchRequestStore } from "../../../../../lib/store-context";
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
  const store = await matchRequestStore(request);
  if (!store) return NextResponse.json({ error: { code: "ORDER_NOT_FOUND" } }, { status: 404 });
  const order = await getDatabase().order.findFirst({
    where: { id, storeId: store.id },
    select: { status: true, paymentStatus: true, updatedAt: true },
  });
  if (!order) return NextResponse.json({ error: { code: "ORDER_NOT_FOUND" } }, { status: 404 });
  return NextResponse.json(order);
}
