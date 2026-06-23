import { Loader2, Check, X, Clock } from "lucide-react";
import type { LeadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const CONFIG: Record<
  LeadStatus,
  { label: string; icon: typeof Clock; classes: string }
> = {
  pending_analysis: {
    label: "Pending",
    icon: Clock,
    classes: "border-border bg-surface-2 text-fg-muted",
  },
  analyzing: {
    label: "Analyzing…",
    icon: Loader2,
    classes: "border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  },
  qualified: {
    label: "Qualified",
    icon: Check,
    classes: "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  },
  disqualified: {
    label: "Disqualified",
    icon: X,
    classes: "border-border bg-surface-2 text-fg-muted",
  },
};

export function StatusPill({ status }: { status: LeadStatus }) {
  const c = CONFIG[status];
  const Icon = c.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        c.classes,
      )}
    >
      <Icon className={cn("h-3 w-3", status === "analyzing" && "animate-spin")} />
      {c.label}
    </span>
  );
}
