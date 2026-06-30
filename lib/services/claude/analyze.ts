import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "./client";
import { getServerConfig } from "@/lib/services/config";
import {
  ANALYZE_TOOL_NAME,
  ANALYZE_TOOL_DESCRIPTION,
  ANALYZE_TOOL_SCHEMA,
} from "./schema";
import { buildAnalyzeSystemPrompt } from "./prompts/analyze-system";
import { buildAnalyzeUserPrompt } from "./prompts/analyze-user";
import { normalizeAnalysis } from "@/lib/services/ai/normalize";
import type { Company, Stakeholder } from "@/lib/types";
import type { AnalyzeOneResult } from "@/lib/services/ai/types";

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

  const analysis = normalizeAnalysis(
    toolUse.input as Record<string, unknown>,
    {
      companyName: company.name,
      stopReason: response.stop_reason,
      outputTokens: response.usage.output_tokens,
    },
  );

  return {
    analysis,
    durationMs: Date.now() - started,
    model,
    cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
    webSearchCount,
  };
}
