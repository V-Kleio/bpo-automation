"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import {
  LayoutDashboard,
  Database,
  Brain,
  Send,
  Briefcase,
  FileText,
  Settings,
  Sparkles,
  ChevronsLeft,
  ChevronsRight,
  X,
  type LucideIcon,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useSidebar } from "./sidebar-context";
import { cn } from "@/lib/utils";

type CountKey = "/leads" | "/intelligence" | "/campaigns" | "/crm";

const NAV: {
  href: string;
  label: string;
  icon: LucideIcon;
  layer: number | null;
  countKey?: CountKey;
}[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard, layer: null },
  { href: "/leads", label: "Lead Database", icon: Database, layer: 1, countKey: "/leads" },
  { href: "/intelligence", label: "AI Intelligence", icon: Brain, layer: 2, countKey: "/intelligence" },
  { href: "/campaigns", label: "Campaigns", icon: Send, layer: 3, countKey: "/campaigns" },
  { href: "/crm", label: "CRM Tracking", icon: Briefcase, layer: 4, countKey: "/crm" },
  { href: "/logs", label: "Logs & Analytics", icon: FileText, layer: null },
  { href: "/settings", label: "Settings", icon: Settings, layer: null },
];

// Slim layer accent shown as the active item's left bar.
const LAYER_ACCENT: Record<number, string> = {
  1: "bg-teal-500",
  2: "bg-blue-500",
  3: "bg-green-500",
  4: "bg-violet-500",
};

function useNavCounts(): Record<CountKey, number> {
  return useStore(
    useShallow((s) => ({
      "/leads": s.companies.filter((c) => c.status === "pending_analysis")
        .length,
      "/intelligence": s.companies.filter((c) => c.analysis).length,
      "/campaigns": s.campaigns.filter(
        (c) => c.stage !== "meeting_booked" && c.stage !== "disqualified",
      ).length,
      "/crm": s.deals.filter(
        (d) => d.stage !== "closed_won" && d.stage !== "closed_lost",
      ).length,
    })),
  );
}

export function Sidebar() {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } =
    useSidebar();

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          "relative z-30 hidden md:flex shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <SidebarBody
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>

      {/* Mobile slide-out drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 animate-in fade-in duration-150"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-64 flex-col border-r border-border bg-surface shadow-xl animate-in slide-in-from-left duration-200">
            <SidebarBody
              collapsed={false}
              mobile
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}

function SidebarBody({
  collapsed,
  mobile,
  onNavigate,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const counts = useNavCounts();

  return (
    <>
      {/* Header */}
      <div
        className={cn(
          "flex h-14 items-center gap-2 border-b border-border",
          collapsed ? "justify-center px-2" : "px-5",
        )}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-fg">
          <Sparkles className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-semibold tracking-tight">
              Wiz.AI Outreach
            </span>
            <span className="text-[10px] uppercase tracking-wider text-fg-muted">
              BPO Automation
            </span>
          </div>
        )}
        {mobile && (
          <button
            onClick={onNavigate}
            className="rounded-md p-1.5 text-fg-muted hover:bg-surface-2 hover:text-fg"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav
        className={cn(
          "flex-1 px-3 py-4",
          collapsed ? "overflow-visible" : "overflow-y-auto",
        )}
      >
        {!collapsed && (
          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
            Workflow
          </div>
        )}
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const count = item.countKey ? counts[item.countKey] : 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center rounded-md py-2 text-sm transition-colors",
                    collapsed ? "justify-center px-2" : "gap-3 px-2",
                    active
                      ? "bg-surface-2 font-medium text-fg"
                      : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  {/* Active layer accent */}
                  {active && (
                    <span
                      className={cn(
                        "absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full",
                        item.layer ? LAYER_ACCENT[item.layer] : "bg-fg",
                      )}
                    />
                  )}

                  <span className="relative shrink-0">
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        active ? "text-fg" : "text-fg-subtle",
                      )}
                    />
                    {/* Collapsed: count as a small overlay badge */}
                    {collapsed && count > 0 && (
                      <span className="absolute -right-2 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[8px] font-bold tabular-nums text-primary-fg">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </span>

                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {count > 0 && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                            active
                              ? "bg-primary text-primary-fg"
                              : "bg-fg/10 text-fg-muted",
                          )}
                        >
                          {count}
                        </span>
                      )}
                    </>
                  )}

                  {/* Collapsed: hover tooltip */}
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-fg shadow group-hover:block">
                      {item.label}
                      {count > 0 ? ` · ${count}` : ""}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer: collapse toggle (desktop only) */}
      {!mobile && (
        <div className="border-t border-border p-3">
          <button
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex w-full items-center gap-2 rounded-md py-2 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg",
              collapsed ? "justify-center px-2" : "px-2",
            )}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" />
                Collapse
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}
