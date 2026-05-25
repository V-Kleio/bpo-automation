"use client";
import { useEffect, useState } from "react";
import { Wifi, Cloud, BellOff, Activity, Mail } from "lucide-react";
import { getClientConfig } from "@/lib/services/public-config-client";
import type { LinkedInProvider } from "@/lib/services/config";
import { cn } from "@/lib/utils";

const PROVIDER_LABEL: Record<LinkedInProvider, string> = {
  unipile: "Unipile",
  mcp: "MCP",
  playwright: "Playwright",
  mock: "Simulated",
};

export function ProviderBadge() {
  const [provider, setProvider] = useState<LinkedInProvider | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    getClientConfig()
      .then((cfg) => {
        setProvider(cfg.linkedin.provider);
        setAuthenticated(cfg.linkedin.authenticated);
      })
      .catch(() => setProvider("mock"));
  }, []);

  if (!provider) return null;

  const tone =
    provider === "mock"
      ? "border-zinc-200 bg-zinc-50 text-zinc-600"
      : authenticated
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  const Icon =
    provider === "mock" ? BellOff : provider === "unipile" ? Cloud : Wifi;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium",
          tone,
        )}
      >
        <Icon className="h-3 w-3" />
        LinkedIn · {PROVIDER_LABEL[provider]}
        {provider !== "mock" && (authenticated ? " · Live" : " · Auth required")}
      </span>
      <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-medium text-zinc-600">
        <Mail className="h-3 w-3" />
        Email · Simulated
      </span>
      {provider !== "mock" && authenticated && (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
          <Activity className="h-3 w-3 animate-pulse" />
          Real outreach
        </span>
      )}
    </div>
  );
}
