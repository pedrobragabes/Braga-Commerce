import { NextResponse } from "next/server";
import { isAuthorizedJobRequest } from "../../../../../lib/jobs/auth";
import { expirePendingOrders } from "../../../../../lib/order-expiration";
import { logEvent } from "../../../../../lib/observability/logger";

export async function POST(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  try {
    const result = await expirePendingOrders();
    logEvent("info", "orders.expiration.completed", { result: `expired:${result.expired}` });
    return NextResponse.json(result);
  } catch (error) {
    logEvent("error", "orders.expiration.failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ error: { code: "EXPIRATION_FAILED" } }, { status: 500 });
  }
}
