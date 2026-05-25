import "server-only";
import { MockLinkedInAdapter } from "./adapter-mock";
import { PlaywrightLinkedInAdapter } from "./adapter-playwright";
import {
  getServerConfig,
  selectLinkedInProvider,
} from "@/lib/services/config";
import type { LinkedInAdapter, LinkedInProvider } from "./types";

let cached: { adapter: LinkedInAdapter; provider: LinkedInProvider } | null =
  null;

export interface ProviderSelection {
  adapter: LinkedInAdapter;
  provider: LinkedInProvider;
  reason: string;
}

export function selectAdapter(): ProviderSelection {
  const cfg = getServerConfig();
  const { provider, reason } = selectLinkedInProvider(cfg);

  if (cached && cached.provider === provider) {
    return { adapter: cached.adapter, provider, reason };
  }

  let adapter: LinkedInAdapter;
  switch (provider) {
    case "playwright":
      adapter = new PlaywrightLinkedInAdapter();
      break;
    // Unipile and MCP adapters land in the next commit.
    case "unipile":
    case "mcp":
    case "mock":
    default:
      adapter = new MockLinkedInAdapter();
      break;
  }

  cached = { adapter, provider };
  return { adapter, provider, reason };
}

export function resetAdapterCache(): void {
  cached = null;
}
