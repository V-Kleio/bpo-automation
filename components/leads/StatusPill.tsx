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
    classes: "border-zinc-200 bg-zinc-50 text-zinc-600",
  },
  analyzing: {
    label: "Analyzing…",
    icon: Loader2,
    classes: "border-blue-200 bg-blue-50 text-blue-700",
  },
  qualified: {
    label: "Qualified",
    icon: Check,
    classes: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  disqualified: {
    label: "Disqualified",
    icon: X,
    classes: "border-zinc-200 bg-zinc-50 text-zinc-500",
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
