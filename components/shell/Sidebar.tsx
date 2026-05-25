"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  Brain,
  Send,
  Briefcase,
  FileText,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  {
    href: "/",
    label: "Overview",
    icon: LayoutDashboard,
    layer: null,
  },
  {
    href: "/leads",
    label: "Lead Database",
    icon: Database,
    layer: 1,
  },
  {
    href: "/intelligence",
    label: "AI Intelligence",
    icon: Brain,
    layer: 2,
  },
  {
    href: "/campaigns",
    label: "Campaigns",
    icon: Send,
    layer: 3,
  },
  {
    href: "/crm",
    label: "CRM Tracking",
    icon: Briefcase,
    layer: 4,
  },
  {
    href: "/logs",
    label: "Logs & Analytics",
    icon: FileText,
    layer: null,
  },
] as const;

const LAYER_LABEL: Record<number, string> = {
  1: "L1 · Data",
  2: "L2 · AI Brain",
  3: "L3 · Engagement",
  4: "L4 · CRM",
};

const LAYER_COLOR: Record<number, string> = {
  1: "text-teal-700 bg-teal-50 border-teal-200",
  2: "text-blue-700 bg-blue-50 border-blue-200",
  3: "text-green-700 bg-green-50 border-green-200",
  4: "text-violet-700 bg-violet-50 border-violet-200",
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="flex h-14 items-center gap-2 border-b border-zinc-200 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">
            Wiz.AI Outreach
          </span>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
            BPO Automation
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Workflow
        </div>
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                    active
                      ? "bg-zinc-100 text-zinc-900 font-medium"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-zinc-900" : "text-zinc-400",
                    )}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.layer != null && (
                    <span
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                        LAYER_COLOR[item.layer],
                      )}
                    >
                      {LAYER_LABEL[item.layer]}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-zinc-200 px-4 py-3">
        <div className="rounded-md bg-zinc-50 px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-700">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Prototype Mode
          </div>
          <p className="mt-1 text-[11px] leading-snug text-zinc-500">
            All data is mocked. No live APIs are called.
          </p>
        </div>
      </div>
    </aside>
  );
}
