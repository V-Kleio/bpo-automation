import { Badge } from "@/components/ui/badge";
import type { Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIER_CLASSES: Record<Tier, string> = {
  priority: "border-red-200 bg-red-50 text-red-700",
  warm: "border-orange-200 bg-orange-50 text-orange-700",
  nurture: "border-indigo-200 bg-indigo-50 text-indigo-700",
};

const TIER_LABEL: Record<Tier, string> = {
  priority: "Priority",
  warm: "Warm",
  nurture: "Nurture",
};

export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <Badge className={cn(TIER_CLASSES[tier], className)}>
      {TIER_LABEL[tier]}
    </Badge>
  );
}
