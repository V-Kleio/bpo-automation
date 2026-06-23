"use client";
import { useEffect, useState } from "react";
import { Wifi, Cloud, AlertCircle, Activity, Mail } from "lucide-react";
import { getClientConfig } from "@/lib/services/public-config-client";
import type { LinkedInProvider } from "@/lib/services/config";
import { cn } from "@/lib/utils";

const PROVIDER_LABEL: Record<LinkedInProvider, string> = {
  unipile: "Unipile",
  mcp: "MCP",
  playwright: "Playwright",
  mock: "Not configured",
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
      ? "border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
      : authenticated
        ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
        : "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300";

  const Icon =
    provider === "mock" ? AlertCircle : provider === "unipile" ? Cloud : Wifi;

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
      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-0.5 font-medium text-fg-muted">
        <Mail className="h-3 w-3" />
        Email · Coming soon
      </span>
      {provider !== "mock" && authenticated && (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
          <Activity className="h-3 w-3 animate-pulse" />
          Live outreach
        </span>
      )}
    </div>
  );
}
