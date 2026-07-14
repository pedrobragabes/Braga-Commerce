import { NextResponse } from "next/server";
import { getDatabase } from "../../../lib/database";
import { logEvent } from "../../../lib/observability/logger";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET() {
  const startedAt = Date.now();

  try {
    await getDatabase().$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        checks: { database: "ok" },
        latencyMs: Date.now() - startedAt,
      },
      { headers: responseHeaders },
    );
  } catch (error) {
    logEvent("error", "health.failed", {
      database: "unavailable",
      errorName: error instanceof Error ? error.name : "UnknownError",
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { status: "degraded", checks: { database: "unavailable" } },
      { status: 503, headers: responseHeaders },
    );
  }
}
