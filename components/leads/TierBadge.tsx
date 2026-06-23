import { Badge } from "@/components/ui/badge";
import type { Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIER_CLASSES: Record<Tier, string> = {
  priority: "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
  warm: "border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300",
  nurture: "border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300",
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
