import { NextResponse } from "next/server";
import { analyzeCompany } from "@/lib/services/claude/analyze";
import { getAnthropic } from "@/lib/services/claude/client";
import type { Company, Stakeholder } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RequestBody {
  companies: Company[];
  stakeholders: Stakeholder[];
}

const PARALLEL = 3;

export async function POST(request: Request) {
  if (!getAnthropic()) {
    return NextResponse.json(
      { error: "Anthropic not configured" },
      { status: 503 },
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const companies = Array.isArray(body.companies) ? body.companies : [];
  const allStakeholders = Array.isArray(body.stakeholders)
    ? body.stakeholders
    : [];

  if (companies.length === 0) {
    return NextResponse.json(
      { error: "No companies provided" },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let cursor = 0;

      const workers: Promise<void>[] = [];
      for (let i = 0; i < Math.min(PARALLEL, companies.length); i++) {
        workers.push(runWorker());
      }
      await Promise.all(workers);
      controller.close();

      async function runWorker() {
        while (true) {
          const idx = cursor++;
          if (idx >= companies.length) return;
          const company = companies[idx];
          const stakeholders = allStakeholders.filter(
            (s) => s.companyId === company.id,
          );
          try {
            const result = await analyzeCompany(company, stakeholders);
            const line =
              JSON.stringify({
                companyId: company.id,
                analysis: result.analysis,
                model: result.model,
                durationMs: result.durationMs,
                cacheReadInputTokens: result.cacheReadInputTokens,
              }) + "\n";
            controller.enqueue(encoder.encode(line));
          } catch (err) {
            // Log the full error server-side so it shows up in `next dev`
            // console output. The client only gets the message string.
            console.error(
              `[/api/analyze-leads] analyzeCompany failed for ${company.name} (${company.id}):`,
              err,
            );
            const message = err instanceof Error ? err.message : String(err);
            const line =
              JSON.stringify({
                companyId: company.id,
                error: message,
              }) + "\n";
            controller.enqueue(encoder.encode(line));
          }
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
