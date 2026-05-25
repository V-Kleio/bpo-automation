import { NextResponse } from "next/server";
import { selectAdapter } from "@/lib/services/linkedin";
import {
  acquireSlot,
  RateLimitExceededError,
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

  // Rate-limit only real providers; the mock adapter is always free.
  if (provider !== "mock") {
    try {
      acquireSlot();
    } catch (err) {
      if (err instanceof RateLimitExceededError) {
        return NextResponse.json(
          {
            success: false,
            provider,
            error: err.message,
            rateLimited: true,
          },
          { status: 429 },
        );
      }
      throw err;
    }
  }

  try {
    if (body.kind === "connect") {
      const result = await adapter.sendConnectionRequest({
        profileUrl: body.profileUrl,
        firstName: body.firstName,
        note: body.note,
      });
      return NextResponse.json(result);
    } else {
      if (!body.body) {
        return NextResponse.json(
          { error: "body is required for dm" },
          { status: 400 },
        );
      }
      const result = await adapter.sendDirectMessage({
        profileUrl: body.profileUrl,
        firstName: body.firstName,
        body: body.body,
        subject: body.subject,
      });
      return NextResponse.json(result);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, provider, error: message },
      { status: 500 },
    );
  }
}
