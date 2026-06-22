import { NextResponse } from "next/server";
import { retryFailed, getSnapshot } from "@/lib/services/linkedin/queue";
import { selectAdapter } from "@/lib/services/linkedin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  // Don't requeue into a dead provider — the worker would just fail them again.
  const { provider } = selectAdapter();
  if (provider === "mock") {
    return NextResponse.json(
      {
        error:
          "LinkedIn is not configured. Connect a session before retrying sends.",
      },
      { status: 412 },
    );
  }

  const { retried } = retryFailed();
  return NextResponse.json({ retried, snapshot: getSnapshot() });
}
