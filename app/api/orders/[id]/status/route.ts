import { NextResponse } from "next/server";
import { getDatabase } from "../../../../../lib/database";
import { pvModaConfig } from "../../../../../storefront/config/pv-moda";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getDatabase().order.findFirst({
    where: { id, store: { slug: pvModaConfig.storeSlug } },
    select: { status: true, paymentStatus: true, updatedAt: true },
  });
  if (!order) return NextResponse.json({ error: { code: "ORDER_NOT_FOUND" } }, { status: 404 });
  return NextResponse.json(order);
}
