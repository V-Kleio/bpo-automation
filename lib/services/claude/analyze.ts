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
import { ANALYZE_SYSTEM_PROMPT } from "./prompts/analyze-system";
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
}

interface ToolInputShape {
  priorityScore: number;
  qualification: AIAnalysis["qualification"];
  partnership: AIAnalysis["partnership"];
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

  const response = await client.messages.create({
    model,
    max_tokens: 16000,
    system: [
      {
        type: "text",
        text: ANALYZE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: ANALYZE_TOOL_NAME,
        description: ANALYZE_TOOL_DESCRIPTION,
        input_schema: ANALYZE_TOOL_SCHEMA as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: ANALYZE_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: buildAnalyzeUserPrompt(company, stakeholders),
      },
    ],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error(
      `Expected tool_use block but got stop_reason=${response.stop_reason}`,
    );
  }

  const input = toolUse.input as ToolInputShape;
  const analysis: AIAnalysis = {
    priorityScore: input.priorityScore,
    qualification: input.qualification,
    partnership: input.partnership,
    generatedMessages: input.generatedMessages.map((m) => ({
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
  };
}
