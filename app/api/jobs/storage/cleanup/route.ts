import { NextResponse } from "next/server";
import { isAuthorizedJobRequest } from "../../../../../lib/jobs/auth";
import { processStorageDeletions } from "../../../../../lib/storage/deletion-outbox";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!isAuthorizedJobRequest(request)) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  try { return NextResponse.json(await processStorageDeletions()); }
  catch { return NextResponse.json({ error: { code: "STORAGE_CLEANUP_UNAVAILABLE" } }, { status: 503 }); }
}
