import "server-only";
// Native Anthropic adapter. Thin wrapper over the existing claude/ service
// (analyze.ts + chat-stream.ts already use the shared normalizeAnalysis core),
// exposed through the provider-neutral AIProvider interface.

import { getServerConfig } from "@/lib/services/config";
import { analyzeCompany } from "@/lib/services/claude/analyze";
import { streamChat } from "@/lib/services/claude/chat-stream";
import type {
  AICapabilities,
  AIProvider,
  AnalyzeOneResult,
  ChatStreamInput,
  ChatStreamResult,
} from "../types";
import type { Company, Stakeholder } from "@/lib/types";

export class AnthropicProvider implements AIProvider {
  readonly kind = "anthropic" as const;

  get capabilities(): AICapabilities {
    const cfg = getServerConfig();
    return {
      supportsWebSearch: cfg.anthropic.webSearchEnabled,
      supportsToolUse: true,
      supportsCacheControl: true,
    };
  }

  analyzeCompany(
    company: Company,
    stakeholders: Stakeholder[],
  ): Promise<AnalyzeOneResult> {
    return analyzeCompany(company, stakeholders);
  }

  streamChat(input: ChatStreamInput): Promise<ChatStreamResult> {
    return streamChat(input);
  }
}
