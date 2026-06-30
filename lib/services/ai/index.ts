import "server-only";
// AI provider singleton. Picks the live adapter from config (mirrors the role
// getAnthropic() played at the route layer). resetAIProvider() is called by the
// settings service after any AI credential change.

import { getServerConfig, selectAIProvider } from "@/lib/services/config";
import { resetAnthropic } from "@/lib/services/claude/client";
import { AnthropicProvider } from "./providers/anthropic";
import { OpenAICompatProvider } from "./providers/openai-compat";
import type { AIProvider } from "./types";

let cached: AIProvider | null | undefined;

export function getAIProvider(): AIProvider | null {
  if (cached !== undefined) return cached;
  const sel = selectAIProvider(getServerConfig());
  cached =
    sel.kind === "anthropic"
      ? new AnthropicProvider()
      : sel.kind === "openai-compat"
        ? new OpenAICompatProvider()
        : null;
  return cached;
}

// Drop the cached provider (and the underlying Anthropic SDK instance, which an
// AnthropicProvider delegates to) so the next getAIProvider() rebuilds from the
// current env.
export function resetAIProvider(): void {
  cached = undefined;
  resetAnthropic();
}

export type { AIProvider } from "./types";
