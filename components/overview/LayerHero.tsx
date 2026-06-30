"use client";
import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import { useStore, selectFunnelCounts } from "@/lib/store";
import { Database, Brain, Send, Briefcase, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const LAYERS: Array<{
  layer: 1 | 2 | 3 | 4;
  title: string;
  subline: string;
  href: string;
  icon: typeof Database;
  metric: "acquired" | "analyzed" | "inCampaign" | "meetingBooked";
  ringClass: string;
  iconClass: string;
}> = [
  {
    layer: 1,
    title: "Smart Data Acquisition",
    subline: "Leads in database",
    href: "/leads",
    icon: Database,
    metric: "acquired",
    ringClass: "border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950/40",
    iconClass: "bg-teal-600 text-white",
  },
  {
    layer: 2,
    title: "Centralized AI Intelligence",
    subline: "Leads analyzed by AI",
    href: "/intelligence",
    icon: Brain,
    metric: "analyzed",
    ringClass: "border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40",
    iconClass: "bg-blue-600 text-white",
  },
  {
    layer: 3,
    title: "Automated Engagement",
    subline: "Companies in active campaign",
    href: "/campaigns",
    icon: Send,
    metric: "inCampaign",
    ringClass: "border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40",
    iconClass: "bg-green-600 text-white",
  },
  {
    layer: 4,
    title: "CRM Tracking",
    subline: "Meetings booked & synced",
    href: "/crm",
    icon: Briefcase,
    metric: "meetingBooked",
    ringClass: "border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-violet-950/40",
    iconClass: "bg-violet-600 text-white",
  },
];

export function LayerHero() {
  const counts = useStore(useShallow(selectFunnelCounts));

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      {LAYERS.map((l, i) => {
        const Icon = l.icon;
        return (
          <Link
            key={l.layer}
            href={l.href}
            className={cn(
              "group relative rounded-lg border bg-surface p-4 shadow-sm transition-all hover:shadow-md",
              l.ringClass,
            )}
          >
            <div className="flex items-start justify-between">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md",
                  l.iconClass,
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span className="rounded border border-current/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fg/80">
                Layer {l.layer}
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tabular-nums text-fg">
                {counts[l.metric]}
              </div>
              <div className="text-[11px] text-fg-muted">{l.subline}</div>
            </div>
            <div className="mt-2 text-sm font-semibold text-fg">
              {l.title}
            </div>
            <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
              <ArrowRight className="h-3.5 w-3.5 text-fg-subtle" />
            </div>
            {i !== LAYERS.length - 1 && (
              <div className="absolute -right-2 top-1/2 hidden h-px w-4 -translate-y-1/2 bg-border-strong lg:block" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
