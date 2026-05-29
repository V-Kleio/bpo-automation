import { NextResponse } from "next/server";
import { enqueue, type EnqueueInput } from "@/lib/services/linkedin/queue";
import { selectAdapter } from "@/lib/services/linkedin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RequestBody {
  items?: EnqueueInput[];
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: "items array is required" },
      { status: 400 },
    );
  }

  const { provider } = selectAdapter();
  if (provider === "mock") {
    return NextResponse.json(
      {
        error:
          "LinkedIn is not configured. Connect a session before queueing sends.",
      },
      { status: 412 },
    );
  }

  for (const item of body.items) {
    if (
      !item.profileUrl ||
      !item.firstName ||
      !item.companyId ||
      !item.stakeholderId ||
      !item.step ||
      !item.kind
    ) {
      return NextResponse.json(
        {
          error:
            "Each item requires profileUrl, firstName, companyId, stakeholderId, step, kind.",
        },
        { status: 400 },
      );
    }
  }

  const { enqueued, skipped } = enqueue(body.items);
  return NextResponse.json({ enqueued, skipped, provider });
}
