"use client";
// Module-cached one-shot fetch of /api/config so client components can
// branch on which integrations are configured without leaking secrets.

import type { PublicConfig } from "@/lib/services/config";

let cache: PublicConfig | null = null;
let inflight: Promise<PublicConfig> | null = null;

export async function getClientConfig(): Promise<PublicConfig> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/api/config", { cache: "no-store" })
    .then((r) => r.json() as Promise<PublicConfig>)
    .then((cfg) => {
      cache = cfg;
      inflight = null;
      return cfg;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}

export function invalidateClientConfig() {
  cache = null;
  inflight = null;
}

export type { PublicConfig };
