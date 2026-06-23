import { Progress } from "@/components/ui/progress";
import type { AIAnalysis } from "@/lib/types";
import {
  Phone,
  TrendingUp,
  Workflow,
  Banknote,
  Cpu,
  ShieldCheck,
  Languages,
  Handshake,
  Compass,
} from "lucide-react";
import { WIZ_CRITERIA, type WizCriterionKey } from "@/lib/services/claude/wiz-criteria";
import { cn } from "@/lib/utils";

const ICONS: Record<WizCriterionKey, typeof Phone> = {
  callVolume: Phone,
  costPressure: TrendingUp,
  useCaseFit: Workflow,
  budgetCapacity: Banknote,
  digitalMaturity: Cpu,
  regulatoryFit: ShieldCheck,
  languageNeed: Languages,
  channelPartnerLeverage: Handshake,
  competitiveWhitespace: Compass,
};

// 0-10 scale. Mirrors the PDF tier thresholds: 9-10 hot, 7-8 warm,
// 5-6 nurture, <5 skip.
function barColor(score: number) {
  if (score >= 9) return "bg-emerald-600";
  if (score >= 7) return "bg-blue-600";
  if (score >= 5) return "bg-amber-500";
  return "bg-red-600";
}

export function QualificationChecklist({
  qualification,
}: {
  qualification: AIAnalysis["qualification"];
}) {
  return (
    <div className="space-y-3">
      {WIZ_CRITERIA.map((c) => {
        const dim = qualification[c.key];
        const Icon = ICONS[c.key];
        // Progress component expects 0-100. Scale 0-10 → 0-100.
        const pct = Math.max(0, Math.min(10, dim.score)) * 10;
        return (
          <div
            key={c.key}
            className="rounded-lg border border-border bg-surface p-3"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-fg-muted">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-fg">
                      {c.no}. {c.label}
                    </div>
                    <div className="text-[11px] text-fg-muted">
                      {c.whatToLookFor}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-fg">
                    {dim.score}
                    <span className="text-fg-subtle">/10</span>
                  </div>
                </div>
                <Progress
                  value={pct}
                  className="mt-2"
                  barClassName={cn("transition-all", barColor(dim.score))}
                />
                <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                  {dim.reasoning}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
