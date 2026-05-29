import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "./client";
import { getServerConfig } from "@/lib/services/config";
import { buildChatSystemPrompt } from "./prompts/chat-system";
import { buildChatUserPrompt } from "./prompts/chat-user";
import type { Company, Stakeholder } from "@/lib/types";

export interface ChatStreamInput {
  prompt: string;
  contextCompanies: Company[];
  contextStakeholders: Stakeholder[];
}

export async function streamChat(input: ChatStreamInput): Promise<{
  stream: AsyncIterable<string>;
  model: string;
}> {
  const client = getAnthropic();
  if (!client) {
    throw new Error("Anthropic client not configured");
  }
  const cfg = getServerConfig();
  const model = cfg.anthropic.modelChat;

  // web_search is a first-party-API server tool; the Claude Max OAuth gateway
  // rejects it. Skip the tool when the flag is off — chat falls back to
  // reasoning over the in-context company facts.
  const tools: Anthropic.Messages.ToolUnion[] | undefined = cfg.anthropic
    .webSearchEnabled
    ? [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3,
        },
      ]
    : undefined;

  const messageStream = client.messages.stream({
    model,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: buildChatSystemPrompt(cfg.anthropic.webSearchEnabled),
        cache_control: { type: "ephemeral" },
      },
    ],
    ...(tools ? { tools } : {}),
    messages: [
      {
        role: "user",
        content: buildChatUserPrompt(input.prompt, {
          companies: input.contextCompanies,
          stakeholders: input.contextStakeholders,
        }),
      },
    ],
  });

  async function* textChunks(): AsyncIterable<string> {
    for await (const event of messageStream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }

  return { stream: textChunks(), model };
}
