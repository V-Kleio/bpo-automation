import { NextResponse } from "next/server";
import { getServerConfig } from "@/lib/services/config";
import { runHeadedLogin } from "@/lib/services/linkedin/adapter-playwright";
import {
  createLoginSession,
  markLoginSession,
} from "@/lib/services/linkedin/login-sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const cfg = getServerConfig();
  if (!cfg.linkedin.playwright.enabled) {
    return NextResponse.json(
      {
        error:
          "Playwright LinkedIn login is disabled. Set ENABLE_PLAYWRIGHT_LINKEDIN=1 in .env.local.",
      },
      { status: 400 },
    );
  }

  const abortSignal = { aborted: false };
  let cancelFn: (() => Promise<void>) | undefined;
  const loginSession = createLoginSession(async () => {
    abortSignal.aborted = true;
    if (cancelFn) await cancelFn();
  });

  try {
    const { cancel } = await runHeadedLogin({
      onSuccess: () => markLoginSession(loginSession.id, "success"),
      onFailure: (msg) => markLoginSession(loginSession.id, "failed", msg),
      abortSignal,
    });
    cancelFn = cancel;
  } catch (err) {
    markLoginSession(
      loginSession.id,
      "failed",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      {
        error:
          "Failed to launch Playwright. Did you run `npx playwright install chromium`?",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    sessionId: loginSession.id,
    state: "pending",
    startedAt: loginSession.startedAt,
  });
}
