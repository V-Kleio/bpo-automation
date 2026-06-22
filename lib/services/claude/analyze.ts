import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "./client";
import { getServerConfig } from "@/lib/services/config";
import { uid } from "@/lib/utils";
import {
  ANALYZE_TOOL_NAME,
  ANALYZE_TOOL_DESCRIPTION,
  ANALYZE_TOOL_SCHEMA,
} from "./schema";
import { buildAnalyzeSystemPrompt } from "./prompts/analyze-system";
import { buildAnalyzeUserPrompt } from "./prompts/analyze-user";
import type {
  AIAnalysis,
  Company,
  GeneratedMessage,
  Stakeholder,
} from "@/lib/types";

interface AnalyzeOneResult {
  analysis: AIAnalysis;
  durationMs: number;
  model: string;
  cacheReadInputTokens: number;
  webSearchCount: number;
}

interface ToolInputShape {
  priorityScore: number;
  qualification: AIAnalysis["qualification"];
  partnership: AIAnalysis["partnership"];
  webResearchSummary?: string;
  generatedMessages: Array<Omit<GeneratedMessage, "id">>;
}

export async function analyzeCompany(
  company: Company,
  stakeholders: Stakeholder[],
): Promise<AnalyzeOneResult> {
  const client = getAnthropic();
  if (!client) {
    throw new Error("Anthropic client not configured");
  }
  const cfg = getServerConfig();
  const model = cfg.anthropic.modelAnalyze;
  const started = Date.now();

  // Tool composition depends on whether web_search is enabled. With it on we
  // need tool_choice=auto so the model can search BEFORE submitting; with it
  // off we can force submit_lead_analysis directly (cheaper, no risk of an
  // unwanted bare text turn).
  const submitTool = {
    name: ANALYZE_TOOL_NAME,
    description: ANALYZE_TOOL_DESCRIPTION,
    input_schema:
      ANALYZE_TOOL_SCHEMA as unknown as Anthropic.Tool.InputSchema,
  };
  const tools: Anthropic.Messages.ToolUnion[] = cfg.anthropic.webSearchEnabled
    ? [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
        },
        submitTool,
      ]
    : [submitTool];
  const toolChoice: Anthropic.Messages.ToolChoice = cfg.anthropic
    .webSearchEnabled
    ? { type: "auto", disable_parallel_tool_use: true }
    : { type: "tool", name: ANALYZE_TOOL_NAME };

  const response = await client.messages.create({
    model,
    max_tokens: 16000,
    system: [
      {
        type: "text",
        text: buildAnalyzeSystemPrompt(cfg.anthropic.webSearchEnabled),
        cache_control: { type: "ephemeral" },
      },
    ],
    tools,
    tool_choice: toolChoice,
    messages: [
      {
        role: "user",
        content: buildAnalyzeUserPrompt(
          company,
          stakeholders,
          cfg.anthropic.webSearchEnabled,
        ),
      },
    ],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === "tool_use" && b.name === ANALYZE_TOOL_NAME,
  );
  if (!toolUse) {
    const textBlocks = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text.slice(0, 200))
      .join(" | ");
    throw new Error(
      `Expected ${ANALYZE_TOOL_NAME} tool_use block but got stop_reason=${response.stop_reason}. ` +
        `Content blocks: ${response.content.map((b) => b.type).join(", ")}.` +
        (textBlocks ? ` Text preview: ${textBlocks}` : ""),
    );
  }

  const webSearchCount = response.content.filter(
    (b) => b.type === "server_tool_use" && b.name === "web_search",
  ).length;

  // Some model versions/gateways wrap the entire tool input inside a
  // "parameter" key — unwrap it before validation.
  let rawInput = toolUse.input as Record<string, unknown>;
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
      `submit_lead_analysis returned incomplete payload (stop_reason=${response.stop_reason}, ` +
        `output_tokens=${response.usage.output_tokens}). ` +
        `Missing required fields — model may have hit max_tokens. Got keys: ${Object.keys(rawInput).join(", ") || "(empty)"}.`,
    );
  }
  const rawMessages = input.generatedMessages;
  if (!Array.isArray(rawMessages)) {
    console.warn(
      `[analyzeCompany] ${company.name}: generatedMessages missing from tool input ` +
        `(stop_reason=${response.stop_reason}, output_tokens=${response.usage.output_tokens}). ` +
        `Saving analysis without messages.`,
    );
  }
  const analysis: AIAnalysis = {
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

  return {
    analysis,
    durationMs: Date.now() - started,
    model,
    cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
    webSearchCount,
  };
}
