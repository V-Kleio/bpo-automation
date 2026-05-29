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
  // Two supported auth paths:
  //  1) ANTHROPIC_API_KEY            — first-party API (x-api-key header)
  //  2) ANTHROPIC_AUTH_TOKEN [+ BASE_URL] — OAuth bearer (Authorization),
  //     used to route through Claude Max as a stop-gap until a real key.
  // Precedence: authToken wins when both are present (the gateway typically
  // rejects mixed auth, and the user has signalled the OAuth path).
  const init: ConstructorParameters<typeof Anthropic>[0] = {};
  if (cfg.anthropic.authToken) {
    init.authToken = cfg.anthropic.authToken;
    // The SDK passes apiKey="" through to the x-api-key header when unset,
    // which the gateway rejects alongside a bearer. Force empty explicitly.
    init.apiKey = "";
  } else {
    init.apiKey = cfg.anthropic.apiKey;
  }
  if (cfg.anthropic.baseURL) {
    init.baseURL = cfg.anthropic.baseURL;
  }
  cached = new Anthropic(init);
  return cached;
}
