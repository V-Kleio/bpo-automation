"use client";
import { useStore, selectCompany } from "@/lib/store";
import { TierBadge } from "@/components/leads/TierBadge";
import { ROLE_LABEL, type CampaignLead } from "@/lib/types";
import { formatRelative } from "@/lib/utils";
import { Clock } from "lucide-react";
import { STEP_TO_ROLE } from "@/lib/types";

export function CompanyCard({
  campaign,
  onOpen,
  nowIso,
}: {
  campaign: CampaignLead;
  onOpen: () => void;
  nowIso: string;
}) {
  const company = useStore((s) => selectCompany(campaign.companyId)(s));
  const stakeholder = useStore((s) =>
    s.stakeholders.find(
      (st) =>
        st.companyId === campaign.companyId &&
        st.role === STEP_TO_ROLE[campaign.activeStep],
    ),
  );
  const lastTp = campaign.touchpoints[campaign.touchpoints.length - 1];

  if (!company) return null;

  const stepDots = [1, 2, 3, 4] as const;

  return (
    <button
      onClick={onOpen}
      className="group block w-full rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-sm transition-all hover:border-zinc-300 hover:shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900">
            {company.name}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-zinc-500">
            {company.industry[0]} · {company.hq}
          </div>
        </div>
        <TierBadge tier={company.tier} />
      </div>

      {/* Step progress */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          <span>
            Step {campaign.activeStep}/4 ·{" "}
            <span className="text-zinc-700 normal-case font-medium">
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
                    : "bg-zinc-200")
                }
              />
            );
          })}
        </div>
      </div>

      {/* Active stakeholder */}
      {stakeholder && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-zinc-50 px-2 py-1.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[9px] font-semibold text-white">
            {stakeholder.name
              .split(" ")
              .filter(Boolean)
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold text-zinc-900">
              {stakeholder.name}
            </div>
            <div className="truncate text-[10px] text-zinc-500">
              {stakeholder.title}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-2.5 flex items-center justify-between text-[10px] text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {lastTp
            ? `${formatRelative(lastTp.sentAt, nowIso)}`
            : "Awaiting first touch"}
        </span>
        <span>
          {campaign.touchpoints.length} touchpoint
          {campaign.touchpoints.length === 1 ? "" : "s"}
        </span>
      </div>
    </button>
  );
}
