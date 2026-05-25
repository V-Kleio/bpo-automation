import "server-only";
import { getAnthropic } from "./client";
import { getServerConfig } from "@/lib/services/config";
import { CHAT_SYSTEM_PROMPT } from "./prompts/chat-system";
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

  const messageStream = client.messages.stream({
    model,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: CHAT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
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
