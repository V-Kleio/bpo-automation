import type { AIAnalysis } from "@/lib/types";
import { Handshake, Cpu, TrendingUp, Globe } from "lucide-react";

const FIELDS: Array<{
  key: keyof AIAnalysis["partnership"];
  label: string;
  icon: typeof Handshake;
}> = [
  { key: "strategicAlignment", label: "Strategic Alignment", icon: Handshake },
  { key: "aiReadiness", label: "AI Readiness", icon: Cpu },
  { key: "growthPotential", label: "Growth Potential", icon: TrendingUp },
  { key: "localizationFit", label: "Localization Fit", icon: Globe },
];

export function PartnershipPanel({
  partnership,
}: {
  partnership: AIAnalysis["partnership"];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {FIELDS.map((f) => {
        const Icon = f.icon;
        return (
          <div
            key={f.key}
            className="rounded-lg border border-zinc-200 bg-white p-3"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
              <Icon className="h-3.5 w-3.5 text-zinc-500" />
              {f.label}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
              {partnership[f.key]}
            </p>
          </div>
        );
      })}
    </div>
  );
}
