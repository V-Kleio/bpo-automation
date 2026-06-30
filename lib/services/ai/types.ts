import "server-only";
// The provider abstraction. Every reasoning backend (Anthropic native, or any
// OpenAI-compatible endpoint) implements AIProvider so the API routes can stay
// provider-neutral. Result shapes mirror the original Anthropic service exactly
// so the routes and the client ai-router don't change their contracts.

import type { AIAnalysis, Company, Stakeholder } from "@/lib/types";

export type AIProviderKind = "anthropic" | "openai-compat";

export interface AICapabilities {
  // Anthropic first-party server-side web_search. OpenAI-compatible endpoints
  // have no portable equivalent, so it's false there (prompts degrade to the
  // no-search variant).
  supportsWebSearch: boolean;
  // Function/tool calling for structured analysis. When false (forced
  // json_object mode) the provider relies on schema-in-prompt + extraction.
  supportsToolUse: boolean;
  // Anthropic prompt caching (cache_control). Off for everyone else.
  supportsCacheControl: boolean;
}

export interface AnalyzeOneResult {
  analysis: AIAnalysis;
  durationMs: number;
  model: string;
  // 0 for providers without prompt caching.
  cacheReadInputTokens: number;
  // 0 when web search is unsupported or off.
  webSearchCount: number;
}

export interface ChatStreamInput {
  prompt: string;
  contextCompanies: Company[];
  contextStakeholders: Stakeholder[];
}

export interface ChatStreamResult {
  stream: AsyncIterable<string>;
  model: string;
}

export interface AIProvider {
  readonly kind: AIProviderKind;
  readonly capabilities: AICapabilities;
  analyzeCompany(
    company: Company,
    stakeholders: Stakeholder[],
  ): Promise<AnalyzeOneResult>;
  streamChat(input: ChatStreamInput): Promise<ChatStreamResult>;
}
