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
    classes: "border-zinc-200 bg-zinc-50 text-zinc-700",
    icon: Clock,
  },
  connection_sent: {
    label: "Connection Sent",
    classes: "border-blue-200 bg-blue-50 text-blue-700",
    icon: LinkedinIcon,
  },
  email_sequence_active: {
    label: "Email Sequence",
    classes: "border-indigo-200 bg-indigo-50 text-indigo-700",
    icon: Mail,
  },
  replied: {
    label: "Replied",
    classes: "border-amber-200 bg-amber-50 text-amber-700",
    icon: MessageSquareReply,
  },
  meeting_booked: {
    label: "Meeting Booked",
    classes: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CalendarCheck,
  },
  disqualified: {
    label: "Disqualified",
    classes: "border-zinc-200 bg-zinc-50 text-zinc-500",
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
