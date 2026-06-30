import "server-only";
// Provider-agnostic validation + normalization of a raw structured-analysis
// payload into a clean AIAnalysis. Extracted from the original Anthropic
// analyze.ts so every provider (Anthropic tool-use, OpenAI-compatible
// function-calling, or JSON-mode) reuses the same hard-won logic: the
// `{ parameter: {...} }` gateway unwrap, required-field validation, the
// missing-messages warning, server-side message IDs, and analyzedAt.

import { uid } from "@/lib/utils";
import type { AIAnalysis, GeneratedMessage } from "@/lib/types";

interface ToolInputShape {
  priorityScore: number;
  qualification: AIAnalysis["qualification"];
  partnership: AIAnalysis["partnership"];
  webResearchSummary?: string;
  generatedMessages: Array<Omit<GeneratedMessage, "id">>;
}

export interface NormalizeContext {
  companyName: string;
  // Diagnostic only — surfaced in the "incomplete payload" error so a
  // truncated/mis-shaped response is easy to debug. For OpenAI-compatible
  // providers we pass the structured-output mode here instead of a stop_reason.
  stopReason?: string | null;
  outputTokens?: number;
}

export function normalizeAnalysis(
  rawInputArg: Record<string, unknown>,
  ctx: NormalizeContext,
): AIAnalysis {
  // Some model versions/gateways wrap the entire payload inside a "parameter"
  // key — unwrap it before validation.
  let rawInput = rawInputArg;
  if (
    Object.keys(rawInput).length === 1 &&
    "parameter" in rawInput &&
    typeof rawInput.parameter === "object" &&
    rawInput.parameter !== null
  ) {
    rawInput = rawInput.parameter as Record<string, unknown>;
  }

  const input = rawInput as Partial<ToolInputShape>;
  if (
    typeof input.priorityScore !== "number" ||
    !input.qualification ||
    !input.partnership
  ) {
    throw new Error(
      `Analysis returned an incomplete payload (mode=${ctx.stopReason ?? "?"}, ` +
        `output_tokens=${ctx.outputTokens ?? "?"}). ` +
        `Missing required fields — the model may have hit max_tokens. Got keys: ${Object.keys(rawInput).join(", ") || "(empty)"}.`,
    );
  }

  const rawMessages = input.generatedMessages;
  if (!Array.isArray(rawMessages)) {
    console.warn(
      `[normalizeAnalysis] ${ctx.companyName}: generatedMessages missing from the analysis ` +
        `payload (mode=${ctx.stopReason ?? "?"}, output_tokens=${ctx.outputTokens ?? "?"}). ` +
        `Saving analysis without messages.`,
    );
  }

  return {
    priorityScore: input.priorityScore,
    qualification: input.qualification,
    partnership: input.partnership,
    webResearchSummary: input.webResearchSummary?.trim() || undefined,
    generatedMessages: (rawMessages ?? []).map((m) => ({
      ...m,
      id: uid("msg"),
    })),
    analyzedAt: new Date().toISOString(),
  };
}
