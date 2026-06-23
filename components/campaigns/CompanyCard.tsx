"use client";
import { useStore, selectCompany } from "@/lib/store";
import { TierBadge } from "@/components/leads/TierBadge";
import { ROLE_LABEL, type CampaignLead } from "@/lib/types";
import { formatRelative } from "@/lib/utils";
import { Clock, Mail } from "lucide-react";
import { LinkedinIcon } from "@/components/ui/icons";
import { STEP_TO_ROLE } from "@/lib/types";
import type { ChannelFilter } from "./ChannelTabs";

export function CompanyCard({
  campaign,
  onOpen,
  nowIso,
  channelFilter = "all",
}: {
  campaign: CampaignLead;
  onOpen: () => void;
  nowIso: string;
  channelFilter?: ChannelFilter;
}) {
  const company = useStore((s) => selectCompany(campaign.companyId)(s));
  const stakeholder = useStore((s) =>
    s.stakeholders.find(
      (st) =>
        st.companyId === campaign.companyId &&
        st.role === STEP_TO_ROLE[campaign.activeStep],
    ),
  );
  const filteredTouchpoints =
    channelFilter === "all"
      ? campaign.touchpoints
      : campaign.touchpoints.filter((t) => t.channel === channelFilter);
  const lastTp = filteredTouchpoints[filteredTouchpoints.length - 1];
  const linkedinCount = campaign.touchpoints.filter(
    (t) => t.channel === "linkedin",
  ).length;
  const emailCount = campaign.touchpoints.filter(
    (t) => t.channel === "email",
  ).length;

  if (!company) return null;

  const stepDots = [1, 2, 3, 4] as const;

  return (
    <button
      onClick={onOpen}
      className="group block w-full rounded-lg border border-border bg-surface p-3 text-left shadow-sm transition-all hover:border-border-strong hover:shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-fg">
            {company.name}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-fg-muted">
            {company.industry[0]} · {company.hq}
          </div>
        </div>
        <TierBadge tier={company.tier} />
      </div>

      {/* Step progress */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
          <span>
            Step {campaign.activeStep}/4 ·{" "}
            <span className="text-fg normal-case font-medium">
              {ROLE_LABEL[STEP_TO_ROLE[campaign.activeStep]]}
            </span>
          </span>
        </div>
        <div className="mt-1 flex gap-1">
          {stepDots.map((s) => {
            const passed = s < campaign.activeStep;
            const active = s === campaign.activeStep;
            return (
              <div
                key={s}
                className={
                  "h-1 flex-1 rounded-full " +
                  (passed
                    ? "bg-emerald-500"
                    : active
                    ? "bg-blue-500"
                    : "bg-surface-2")
                }
              />
            );
          })}
        </div>
      </div>

      {/* Active stakeholder */}
      {stakeholder && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-surface-2 px-2 py-1.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-fg">
            {stakeholder.name
              .split(" ")
              .filter(Boolean)
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold text-fg">
              {stakeholder.name}
            </div>
            <div className="truncate text-[10px] text-fg-muted">
              {stakeholder.title}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-2.5 flex items-center justify-between gap-2 text-[10px] text-fg-muted">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {lastTp
            ? `${formatRelative(lastTp.sentAt, nowIso)}`
            : channelFilter === "all"
              ? "Awaiting first touch"
              : `No ${channelFilter} yet`}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {(channelFilter === "all" || channelFilter === "linkedin") && (
            <span
              className={
                "inline-flex items-center gap-0.5 " +
                (linkedinCount > 0 ? "text-blue-700 dark:text-blue-300" : "text-fg-subtle")
              }
            >
              <LinkedinIcon className="h-2.5 w-2.5" />
              {linkedinCount}
            </span>
          )}
          {(channelFilter === "all" || channelFilter === "email") && (
            <span
              className={
                "inline-flex items-center gap-0.5 " +
                (emailCount > 0 ? "text-indigo-700 dark:text-indigo-300" : "text-fg-subtle")
              }
            >
              <Mail className="h-2.5 w-2.5" />
              {emailCount}
            </span>
          )}
        </span>
      </div>
    </button>
  );
}
