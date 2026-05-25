import { Progress } from "@/components/ui/progress";
import type { AIAnalysis } from "@/lib/types";
import { Briefcase, Activity, Cpu, Radio, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";

const DIMS: Array<{
  key: keyof AIAnalysis["qualification"];
  label: string;
  description: string;
  icon: typeof Briefcase;
}> = [
  {
    key: "industryFit",
    label: "Industry Fit",
    description: "ICP alignment to Wiz.AI's BFSI / Telecom / CX wheelhouse",
    icon: Briefcase,
  },
  {
    key: "operationalPain",
    label: "Operational Pain",
    description: "Headcount-driven manual workload + scaling signals",
    icon: Activity,
  },
  {
    key: "digitalMaturity",
    label: "Digital Maturity",
    description: "Readiness to integrate AI into the existing stack",
    icon: Cpu,
  },
  {
    key: "buyingSignals",
    label: "Buying Signals",
    description: "Recent hiring, DX, funding, or expansion intent",
    icon: Radio,
  },
  {
    key: "budgetPotential",
    label: "Budget Potential",
    description: "Plausible ACV based on tier and account size",
    icon: Banknote,
  },
];

function barColor(score: number) {
  if (score >= 80) return "bg-emerald-600";
  if (score >= 65) return "bg-blue-600";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-600";
}

export function QualificationChecklist({
  qualification,
}: {
  qualification: AIAnalysis["qualification"];
}) {
  return (
    <div className="space-y-3">
      {DIMS.map((d) => {
        const dim = qualification[d.key];
        const Icon = d.icon;
        return (
          <div
            key={d.key}
            className="rounded-lg border border-zinc-200 bg-white p-3"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      {d.label}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {d.description}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-zinc-900">
                    {dim.score}
                  </div>
                </div>
                <Progress
                  value={dim.score}
                  className="mt-2"
                  barClassName={cn("transition-all", barColor(dim.score))}
                />
                <p className="mt-2 text-xs leading-relaxed text-zinc-600">
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
