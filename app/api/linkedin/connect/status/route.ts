import { NextResponse } from "next/server";
import { getLoginSession } from "@/lib/services/linkedin/login-sessions";
import { resetAdapterCache } from "@/lib/services/linkedin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 },
    );
  }
  const session = getLoginSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "Login session not found (likely expired or process restarted)" },
      { status: 404 },
    );
  }
  if (session.state === "success") {
    // Re-evaluate adapter so subsequent calls go through Playwright.
    resetAdapterCache();
  }
  return NextResponse.json({
    id: session.id,
    state: session.state,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    error: session.error,
  });
}
