import * as React from "react";
import type { CampaignStage } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Clock,
  Mail,
  MessageSquareReply,
  CalendarCheck,
  Ban,
} from "lucide-react";
import { LinkedinIcon } from "@/components/ui/icons";

const CONFIG: Record<
  CampaignStage,
  {
    label: string;
    classes: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  queued: {
    label: "Queued",
    classes: "border-border bg-surface-2 text-fg",
    icon: Clock,
  },
  connection_sent: {
    label: "Connection Sent",
    classes: "border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
    icon: LinkedinIcon,
  },
  email_sequence_active: {
    label: "Email Sequence",
    classes: "border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300",
    icon: Mail,
  },
  replied: {
    label: "Replied",
    classes: "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
    icon: MessageSquareReply,
  },
  meeting_booked: {
    label: "Meeting Booked",
    classes: "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
    icon: CalendarCheck,
  },
  disqualified: {
    label: "Disqualified",
    classes: "border-border bg-surface-2 text-fg-muted",
    icon: Ban,
  },
};

export function StageBadge({
  stage,
  className,
}: {
  stage: CampaignStage;
  className?: string;
}) {
  const c = CONFIG[stage];
  const Icon = c.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        c.classes,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

export const STAGE_CONFIG = CONFIG;

export const STAGES_ORDERED: CampaignStage[] = [
  "queued",
  "connection_sent",
  "email_sequence_active",
  "replied",
  "meeting_booked",
  "disqualified",
];
