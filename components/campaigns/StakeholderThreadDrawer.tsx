"use client";
import { useShallow } from "zustand/react/shallow";
import { useStore, selectCompany, selectCampaign } from "@/lib/store";
import { Drawer } from "@/components/ui/drawer";
import { TierBadge } from "@/components/leads/TierBadge";
import { StageBadge } from "./StageBadge";
import {
  ROLE_LABEL,
  STEP_TO_ROLE,
  type Stakeholder,
  type Touchpoint,
} from "@/lib/types";
import { formatRelative } from "@/lib/utils";
import {
  Check,
  Circle,
  Mail,
  MessageSquareReply,
  Send,
  CornerDownRight,
} from "lucide-react";
import { LinkedinIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export function StakeholderThreadDrawer({
  companyId,
  onClose,
}: {
  companyId: string | null;
  onClose: () => void;
}) {
  const company = useStore((s) =>
    companyId ? selectCompany(companyId)(s) : undefined,
  );
  const campaign = useStore((s) =>
    companyId ? selectCampaign(companyId)(s) : undefined,
  );
  const stakeholders = useStore(
    useShallow((s) =>
      companyId ? s.stakeholders.filter((st) => st.companyId === companyId) : [],
    ),
  );
  const now = useStore((s) => s.clock.simulatedTime);

  return (
    <Drawer
      open={!!companyId && !!company && !!campaign}
      onClose={onClose}
      title={company?.name}
      description={
        campaign
          ? `Step ${campaign.activeStep}/4 · ${ROLE_LABEL[STEP_TO_ROLE[campaign.activeStep]]}`
          : undefined
      }
      width="max-w-2xl"
    >
      {company && campaign && (
        <div className="p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <TierBadge tier={company.tier} />
            <StageBadge stage={campaign.stage} />
            {company.analysis && (
              <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                Score {company.analysis.priorityScore}
              </span>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Outreach Sequence
            </h3>
            <ol className="space-y-3">
              {[1, 2, 3, 4].map((stepRaw) => {
                const step = stepRaw as 1 | 2 | 3 | 4;
                const role = STEP_TO_ROLE[step];
                const stakeholder = stakeholders.find((s) => s.role === role);
                const tps = campaign.touchpoints.filter((t) => t.step === step);
                const replied = tps.some(
                  (t) => t.type === "reply_received" || t.status === "replied",
                );
                const sentAny = tps.length > 0;
                const isActive = campaign.activeStep === step;
                const passed = campaign.activeStep > step;

                return (
                  <li key={step} className="relative">
                    {step !== 4 && (
                      <div className="absolute left-3 top-7 bottom-[-12px] w-px bg-zinc-200" />
                    )}
                    <div className="flex items-start gap-3">
                      <StepDot
                        passed={passed || replied}
                        active={isActive && !replied}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-zinc-900">
                              Step {step} · {ROLE_LABEL[role]}
                            </div>
                            {stakeholder ? (
                              <div className="mt-0.5 text-xs text-zinc-600">
                                <span className="font-medium text-zinc-800">
                                  {stakeholder.name}
                                </span>{" "}
                                — {stakeholder.title}
                              </div>
                            ) : (
                              <div className="text-xs text-zinc-400 italic">
                                No stakeholder mapped
                              </div>
                            )}
                          </div>
                          <StepStatus
                            sentAny={sentAny}
                            replied={replied}
                            active={isActive}
                          />
                        </div>

                        {/* Touchpoints */}
                        {tps.length > 0 && (
                          <ul className="mt-2 space-y-1.5">
                            {tps.map((t) => (
                              <TouchpointRow
                                key={t.id}
                                tp={t}
                                stakeholder={stakeholder}
                                now={now}
                              />
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function StepDot({ passed, active }: { passed: boolean; active: boolean }) {
  if (passed) {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </div>
    );
  }
  if (active) {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 bg-white text-blue-600">
        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
      </div>
    );
  }
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-zinc-300 bg-white text-zinc-400">
      <Circle className="h-2 w-2 fill-current" />
    </div>
  );
}

function StepStatus({
  sentAny,
  replied,
  active,
}: {
  sentAny: boolean;
  replied: boolean;
  active: boolean;
}) {
  if (replied)
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
        Replied
      </span>
    );
  if (sentAny)
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
        In flight
      </span>
    );
  if (active)
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
        Active
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
      Pending
    </span>
  );
}

function TouchpointRow({
  tp,
  stakeholder,
  now,
}: {
  tp: Touchpoint;
  stakeholder?: Stakeholder;
  now: string;
}) {
  const isReply = tp.type === "reply_received";
  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs",
        isReply
          ? "border-emerald-200 bg-emerald-50/40"
          : "border-zinc-200 bg-white",
      )}
    >
      <div className="mt-0.5 shrink-0 text-zinc-500">
        {isReply ? (
          <CornerDownRight className="h-3.5 w-3.5 text-emerald-600" />
        ) : tp.channel === "linkedin" ? (
          <LinkedinIcon className="h-3.5 w-3.5 text-blue-600" />
        ) : tp.channel === "email" ? (
          <Mail className="h-3.5 w-3.5 text-indigo-600" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-zinc-800">
          {tp.messagePreview}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-500">
          <span>{formatRelative(tp.sentAt, now)}</span>
          {stakeholder && <span>· {stakeholder.name}</span>}
        </div>
      </div>
      {isReply && (
        <MessageSquareReply className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
      )}
    </li>
  );
}
