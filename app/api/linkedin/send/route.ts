import { NextResponse } from "next/server";
import { selectAdapter } from "@/lib/services/linkedin";
import {
  acquireSlot,
  getUsage,
} from "@/lib/services/linkedin/rate-limiter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RequestBody {
  kind: "connect" | "dm";
  profileUrl: string;
  firstName: string;
  note?: string;
  subject?: string;
  body?: string;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.profileUrl) {
    return NextResponse.json(
      { error: "profileUrl is required" },
      { status: 400 },
    );
  }

  const { adapter, provider } = selectAdapter();

  if (provider === "mock") {
    return NextResponse.json(
      {
        success: false,
        provider,
        error:
          "LinkedIn is not configured. Set ENABLE_PLAYWRIGHT_LINKEDIN=1 (or UNIPILE_API_KEY) and connect a session.",
      },
      { status: 412 },
    );
  }

  // Check cap before attempting the send — only count successful sends.
  const usage = getUsage();
  if (usage.remaining <= 0) {
    return NextResponse.json(
      {
        success: false,
        provider,
        error: `LinkedIn daily cap reached: ${usage.used} of ${usage.cap}. Try again tomorrow.`,
        rateLimited: true,
      },
      { status: 429 },
    );
  }

  try {
    let result;
    if (body.kind === "connect") {
      result = await adapter.sendConnectionRequest({
        profileUrl: body.profileUrl,
        firstName: body.firstName,
        note: body.note,
      });
    } else {
      if (!body.body) {
        return NextResponse.json(
          { error: "body is required for dm" },
          { status: 400 },
        );
      }
      result = await adapter.sendDirectMessage({
        profileUrl: body.profileUrl,
        firstName: body.firstName,
        body: body.body,
        subject: body.subject,
      });
    }
    // Only count against the daily cap when the send actually succeeded.
    if (result.success) {
      acquireSlot();
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, provider, error: message },
      { status: 500 },
    );
  }
}
