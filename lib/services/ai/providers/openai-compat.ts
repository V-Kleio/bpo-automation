import "server-only";
// Generic OpenAI-compatible adapter (Chat Completions API). One adapter covers
// Groq, OpenRouter, Google Gemini's compat endpoint, Ollama, DeepSeek, Together,
// LM Studio, vLLM, etc. — anything that speaks /chat/completions. Raw fetch, no
// SDK dependency.
//
// Web search and prompt caching are Anthropic-only, so prompts are always built
// with the no-search variant and cache_control is never sent.

import { getServerConfig } from "@/lib/services/config";
import {
  ANALYZE_TOOL_NAME,
  ANALYZE_TOOL_DESCRIPTION,
  ANALYZE_TOOL_SCHEMA,
} from "@/lib/services/claude/schema";
import { buildAnalyzeSystemPrompt } from "@/lib/services/claude/prompts/analyze-system";
import { buildAnalyzeUserPrompt } from "@/lib/services/claude/prompts/analyze-user";
import { buildChatSystemPrompt } from "@/lib/services/claude/prompts/chat-system";
import { buildChatUserPrompt } from "@/lib/services/claude/prompts/chat-user";
import { normalizeAnalysis } from "../normalize";
import { extractJsonObject, buildAnalyzeJsonInstruction } from "../extract";
import type {
  AICapabilities,
  AIProvider,
  AnalyzeOneResult,
  ChatStreamInput,
  ChatStreamResult,
} from "../types";
import type { Company, Stakeholder } from "@/lib/types";

type StructuredMode = "auto" | "tools" | "json_object";

interface ResolvedConfig {
  baseURL: string;
  apiKey: string;
  modelAnalyze: string;
  modelChat: string;
  structuredMode: StructuredMode;
  maxTokens: number;
}

// Remembers, per (baseURL|model), which structured-output strategy actually
// worked, so `auto` doesn't re-probe (and re-bill) the tools path every call.
const workingMode = new Map<string, "tools" | "json_object">();

function readConfig(): ResolvedConfig {
  const o = getServerConfig().ai.openai;
  if (!o.baseURL) {
    throw new Error("OpenAI-compatible base URL is not configured.");
  }
  return {
    baseURL: o.baseURL.replace(/\/+$/, ""),
    apiKey: o.apiKey,
    modelAnalyze: o.modelAnalyze,
    modelChat: o.modelChat,
    structuredMode: (o.structuredMode as StructuredMode) || "auto",
    maxTokens: o.maxTokens > 0 ? o.maxTokens : 4096,
  };
}

function requireModel(model: string, which: "analysis" | "chat"): string {
  if (!model) {
    throw new Error(
      `OpenAI-compatible ${which} model is not set — configure it in Settings.`,
    );
  }
  return model;
}

function authHeaders(apiKey: string): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) h["authorization"] = `Bearer ${apiKey}`;
  return h;
}

function endpoint(cfg: ResolvedConfig): string {
  return `${cfg.baseURL}/chat/completions`;
}

function post(
  cfg: ResolvedConfig,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(endpoint(cfg), {
    method: "POST",
    headers: authHeaders(cfg.apiKey),
    body: JSON.stringify(body),
  });
}

async function describeError(res: Response): Promise<string> {
  let detail = "";
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text) as {
        error?: { message?: string } | string;
        message?: string;
      };
      const e = j.error;
      detail =
        (typeof e === "object" && e?.message) ||
        (typeof e === "string" ? e : "") ||
        j.message ||
        text;
    } catch {
      detail = text;
    }
  } catch {
    /* ignore */
  }
  return `HTTP ${res.status}${detail ? `: ${String(detail).slice(0, 400)}` : ""}`;
}

// Tolerant SSE → text-chunk generator. Yields choices[0].delta.content,
// stopping on [DONE]; ignores keep-alive / usage-only frames.
async function* sseTextChunks(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) >= 0) {
        const event = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const line of event.split("\n")) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const data = t.slice(5).trim();
          if (data === "[DONE]") return;
          try {
            const json = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const delta = json.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length > 0) yield delta;
          } catch {
            // non-JSON keep-alive — skip
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export class OpenAICompatProvider implements AIProvider {
  readonly kind = "openai-compat" as const;

  get capabilities(): AICapabilities {
    const mode =
      (getServerConfig().ai.openai.structuredMode as StructuredMode) || "auto";
    return {
      supportsWebSearch: false,
      supportsToolUse: mode !== "json_object",
      supportsCacheControl: false,
    };
  }

  async analyzeCompany(
    company: Company,
    stakeholders: Stakeholder[],
  ): Promise<AnalyzeOneResult> {
    const cfg = readConfig();
    const model = requireModel(cfg.modelAnalyze, "analysis");
    const started = Date.now();
    const system = buildAnalyzeSystemPrompt(false);
    const user = buildAnalyzeUserPrompt(company, stakeholders, false);

    const cacheKey = `${cfg.baseURL}|${model}`;
    const requested =
      cfg.structuredMode === "auto"
        ? (workingMode.get(cacheKey) ?? "tools")
        : cfg.structuredMode;

    let rawInput: Record<string, unknown>;
    let used: "tools" | "json_object";

    if (requested === "tools") {
      try {
        rawInput = await this.analyzeViaTools(cfg, model, system, user);
        used = "tools";
      } catch (err) {
        if (cfg.structuredMode !== "auto") throw err;
        // Model/endpoint doesn't do (reliable) function-calling — fall back.
        rawInput = await this.analyzeViaJson(cfg, model, system, user);
        used = "json_object";
      }
    } else {
      rawInput = await this.analyzeViaJson(cfg, model, system, user);
      used = "json_object";
    }

    if (cfg.structuredMode === "auto") workingMode.set(cacheKey, used);

    const analysis = normalizeAnalysis(rawInput, {
      companyName: company.name,
      stopReason: used,
    });
    return {
      analysis,
      durationMs: Date.now() - started,
      model,
      cacheReadInputTokens: 0,
      webSearchCount: 0,
    };
  }

  private async analyzeViaTools(
    cfg: ResolvedConfig,
    model: string,
    system: string,
    user: string,
  ): Promise<Record<string, unknown>> {
    const res = await post(cfg, {
      model,
      max_tokens: cfg.maxTokens,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: ANALYZE_TOOL_NAME,
            description: ANALYZE_TOOL_DESCRIPTION,
            parameters: ANALYZE_TOOL_SCHEMA,
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: ANALYZE_TOOL_NAME },
      },
    });
    if (!res.ok) throw new Error(await describeError(res));
    const data = (await res.json()) as {
      choices?: Array<{
        message?: {
          tool_calls?: Array<{ function?: { arguments?: string } }>;
        };
      }>;
    };
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      throw new Error("Model did not return a tool call for the analysis.");
    }
    try {
      return JSON.parse(args) as Record<string, unknown>;
    } catch (err) {
      throw new Error(
        `Failed to parse tool-call arguments as JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async analyzeViaJson(
    cfg: ResolvedConfig,
    model: string,
    system: string,
    user: string,
  ): Promise<Record<string, unknown>> {
    const sys = system + buildAnalyzeJsonInstruction(ANALYZE_TOOL_SCHEMA);
    const base = {
      model,
      max_tokens: cfg.maxTokens,
      temperature: 0,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    };

    // Prefer native JSON mode; retry once without it for endpoints that reject
    // response_format (older Ollama builds, some OpenRouter routes).
    let res = await post(cfg, { ...base, response_format: { type: "json_object" } });
    if (!res.ok) {
      res = await post(cfg, base);
      if (!res.ok) throw new Error(await describeError(res));
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    return extractJsonObject(String(content));
  }

  async streamChat(input: ChatStreamInput): Promise<ChatStreamResult> {
    const cfg = readConfig();
    const model = requireModel(cfg.modelChat, "chat");
    const res = await post(cfg, {
      model,
      max_tokens: cfg.maxTokens,
      stream: true,
      messages: [
        { role: "system", content: buildChatSystemPrompt(false) },
        {
          role: "user",
          content: buildChatUserPrompt(input.prompt, {
            companies: input.contextCompanies,
            stakeholders: input.contextStakeholders,
          }),
        },
      ],
    });
    if (!res.ok || !res.body) throw new Error(await describeError(res));
    return { stream: sseTextChunks(res.body), model };
  }
}
