import { Tooltip } from "@/components/ui/tooltip";
import {
  TrendingUp,
  Users,
  Sparkles,
  Banknote,
  Globe,
} from "lucide-react";
import type { IntentSignal, IntentSignalType } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICON_FOR: Record<IntentSignalType, typeof Users> = {
  hiring: Users,
  digital_transformation: Sparkles,
  funding: Banknote,
  expansion: Globe,
  tech_adoption: TrendingUp,
};

const STRENGTH_CLASS = {
  strong: "border-emerald-200 bg-emerald-50 text-emerald-700",
  moderate: "border-amber-200 bg-amber-50 text-amber-700",
  weak: "border-zinc-200 bg-zinc-50 text-zinc-600",
};

export function IntentSignalChip({ signal }: { signal: IntentSignal }) {
  const Icon = ICON_FOR[signal.type];
  return (
    <Tooltip content={`${signal.label} · ${signal.strength}`}>
      <span
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[11px] font-medium",
          STRENGTH_CLASS[signal.strength],
        )}
      >
        <Icon className="h-3 w-3" />
        <span className="hidden sm:inline truncate max-w-[140px]">
          {signal.label}
        </span>
      </span>
    </Tooltip>
  );
}

export function IntentSignalList({
  signals,
  max = 3,
}: {
  signals: IntentSignal[];
  max?: number;
}) {
  if (signals.length === 0)
    return <span className="text-xs text-zinc-400">—</span>;
  const visible = signals.slice(0, max);
  const hidden = signals.length - visible.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((s, i) => (
        <IntentSignalChip key={i} signal={s} />
      ))}
      {hidden > 0 && (
        <span className="text-[11px] text-zinc-500">+{hidden}</span>
      )}
    </div>
  );
}
