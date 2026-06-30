import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/services/ai";
import type { Company, Stakeholder } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RequestBody {
  prompt: string;
  contextCompanies?: Company[];
  contextStakeholders?: Stakeholder[];
}

export async function POST(request: Request) {
  const provider = getAIProvider();
  if (!provider) {
    return NextResponse.json(
      { error: "AI provider not configured" },
      { status: 503 },
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.prompt || !body.prompt.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  let chat;
  try {
    chat = await provider.streamChat({
      prompt: body.prompt,
      contextCompanies: body.contextCompanies ?? [],
      contextStakeholders: body.contextStakeholders ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of chat.stream) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(`\n\n[AI stream error: ${message}]`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
