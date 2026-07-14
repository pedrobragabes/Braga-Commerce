import { NextResponse } from "next/server";
import { processEmailOutbox } from "../../../../../lib/email/outbox";
import { isAuthorizedJobRequest } from "../../../../../lib/jobs/auth";
import { logEvent } from "../../../../../lib/observability/logger";

export async function POST(request: Request) {
  if (!isAuthorizedJobRequest(request)) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  try {
    const result = await processEmailOutbox();
    logEvent("info", "email.outbox.completed", { result: result.disabled ? "disabled" : `sent:${result.sent}` });
    return NextResponse.json(result);
  } catch (error) {
    logEvent("error", "email.outbox.failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: { code: "EMAIL_OUTBOX_FAILED" } }, { status: 500 });
  }
}
