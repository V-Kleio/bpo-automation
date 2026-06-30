"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Database, Brain, Send } from "lucide-react";

export function QuickActions() {
  const analyzed = useStore(
    (s) => s.companies.filter((c) => c.analysis).length,
  );
  const inCampaign = useStore((s) => s.campaigns.length);

  const ACTIONS = [
    {
      href: "/leads",
      title: "Open Lead Database",
      sub: "Review 20 seeded Indonesian BPO targets",
      icon: Database,
      iconClass: "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300",
    },
    {
      href: "/intelligence",
      title: "Run AI Analysis",
      sub:
        analyzed > 0
          ? `${analyzed} companies analyzed so far`
          : "Send your first batch through the AI provider",
      icon: Brain,
      iconClass: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
    },
    {
      href: "/campaigns",
      title: "View Campaigns",
      sub:
        inCampaign > 0
          ? `${inCampaign} active campaign${inCampaign === 1 ? "" : "s"}`
          : "Push a qualified lead to start outreach",
      icon: Send,
      iconClass: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {ACTIONS.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-2"
          >
            <div className="flex items-center gap-3">
              <div
                className={
                  "flex h-9 w-9 items-center justify-center rounded-md " +
                  a.iconClass
                }
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-fg">
                  {a.title}
                </div>
                <div className="text-xs text-fg-muted">{a.sub}</div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
