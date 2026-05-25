import "server-only";
import { Client } from "@hubspot/api-client";
import { getServerConfig } from "@/lib/services/config";

let cached: Client | null | undefined;

export function getHubSpotClient(): Client | null {
  if (cached !== undefined) return cached;
  const cfg = getServerConfig();
  if (!cfg.hubspot.hasKey) {
    cached = null;
    return null;
  }
  cached = new Client({ accessToken: cfg.hubspot.token });
  return cached;
}

// Reset for tests; not exported in production paths.
export function _resetHubSpotClient() {
  cached = undefined;
}
