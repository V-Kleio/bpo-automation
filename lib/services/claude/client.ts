import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getServerConfig } from "@/lib/services/config";

let cached: Anthropic | null | undefined;

export function getAnthropic(): Anthropic | null {
  if (cached !== undefined) return cached;
  const cfg = getServerConfig();
  if (!cfg.anthropic.hasKey) {
    cached = null;
    return null;
  }
  cached = new Anthropic({ apiKey: cfg.anthropic.apiKey });
  return cached;
}
