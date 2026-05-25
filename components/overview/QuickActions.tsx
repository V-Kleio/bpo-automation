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
      iconClass: "bg-teal-100 text-teal-700",
    },
    {
      href: "/intelligence",
      title: "Run AI Analysis",
      sub:
        analyzed > 0
          ? `${analyzed} companies analyzed so far`
          : "Send your first batch through Claude",
      icon: Brain,
      iconClass: "bg-blue-100 text-blue-700",
    },
    {
      href: "/campaigns",
      title: "View Campaigns",
      sub:
        inCampaign > 0
          ? `${inCampaign} active campaign${inCampaign === 1 ? "" : "s"}`
          : "Push a qualified lead to start outreach",
      icon: Send,
      iconClass: "bg-green-100 text-green-700",
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
            className="rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
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
                <div className="text-sm font-semibold text-zinc-900">
                  {a.title}
                </div>
                <div className="text-xs text-zinc-500">{a.sub}</div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
