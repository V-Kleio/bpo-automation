"use client";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useStore, selectCompany, selectCampaign } from "@/lib/store";
import { Drawer } from "@/components/ui/drawer";
import { TierBadge } from "@/components/leads/TierBadge";
import { StageBadge } from "./StageBadge";
import {
  ROLE_LABEL,
  STEP_TO_ROLE,
  type Channel,
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
import { getClientConfig } from "@/lib/services/public-config-client";
import type { LinkedInProvider } from "@/lib/services/config";
import { StepActions } from "./StepActions";
import { CampaignTerminalActions } from "./CampaignTerminalActions";

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
  const [provider, setProvider] = useState<LinkedInProvider>("mock");
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    getClientConfig()
      .then((cfg) => {
        setProvider(cfg.linkedin.provider);
        setAuthenticated(cfg.linkedin.authenticated);
      })
      .catch(() => {});
  }, []);

  const linkedinIsLive = provider !== "mock" && authenticated;

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
              <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                Score {company.analysis.priorityScore}
              </span>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-muted">
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
                      <div className="absolute left-3 top-7 bottom-[-12px] w-px bg-surface-2" />
                    )}
                    <div className="flex items-start gap-3">
                      <StepDot
                        passed={passed || replied}
                        active={isActive && !replied}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-fg">
                              Step {step} · {ROLE_LABEL[role]}
                            </div>
                            {stakeholder ? (
                              <div className="mt-0.5 text-xs text-fg-muted">
                                <span className="font-medium text-fg">
                                  {stakeholder.name}
                                </span>{" "}
                                — {stakeholder.title}
                              </div>
                            ) : (
                              <div className="text-xs text-fg-subtle italic">
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

                        {/* Touchpoints split by channel — email is not yet
                            active, but we still render any pre-existing
                            email touchpoints so they're not silently lost. */}
                        <ChannelSection
                          channel="linkedin"
                          tps={tps.filter((t) => t.channel === "linkedin")}
                          stakeholder={stakeholder}
                          now={now}
                          live={linkedinIsLive}
                          providerLabel={provider}
                        />
                        <ChannelSection
                          channel="email"
                          tps={tps.filter((t) => t.channel === "email")}
                          stakeholder={stakeholder}
                          now={now}
                          live={false}
                          providerLabel="mock"
                        />

                        {stakeholder && campaign.activeStep === step && (
                          <StepActions
                            company={company}
                            campaign={campaign}
                            stakeholder={stakeholder}
                            step={step}
                            linkedinIsLive={linkedinIsLive}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
              Campaign actions
            </h3>
            <CampaignTerminalActions company={company} campaign={campaign} />
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
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 bg-surface text-blue-600 dark:text-blue-400">
        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
      </div>
    );
  }
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-border-strong bg-surface text-fg-subtle">
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
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
        Replied
      </span>
    );
  if (sentAny)
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
        In flight
      </span>
    );
  if (active)
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
        Active
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
      Pending
    </span>
  );
}

function ChannelSection({
  channel,
  tps,
  stakeholder,
  now,
  live,
  providerLabel,
}: {
  channel: Channel;
  tps: Touchpoint[];
  stakeholder?: Stakeholder;
  now: string;
  live: boolean;
  providerLabel: LinkedInProvider;
}) {
  // For email: only render if there are pre-existing touchpoints to surface.
  // No new email touchpoints can be created — the channel is not active yet.
  if (tps.length === 0) return null;
  const Icon = channel === "linkedin" ? LinkedinIcon : Mail;
  const badgeLabel =
    channel === "email"
      ? "Coming soon"
      : live
        ? `Live · ${providerLabel}`
        : "Not connected";
  const badgeTone =
    channel === "linkedin" && live
      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
      : "bg-surface-2 text-fg-muted";
  return (
    <div className="mt-2.5">
      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
        <span className="inline-flex items-center gap-1">
          <Icon className="h-3 w-3" />
          {channel === "linkedin" ? "LinkedIn" : "Email"}
          <span className="text-fg-subtle normal-case font-normal">
            · {tps.length}
          </span>
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
            badgeTone,
          )}
        >
          {badgeLabel}
        </span>
      </div>
      <ul className="space-y-1.5">
        {tps.map((t) => (
          <TouchpointRow key={t.id} tp={t} stakeholder={stakeholder} now={now} />
        ))}
      </ul>
    </div>
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
          ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/40"
          : "border-border bg-surface",
      )}
    >
      <div className="mt-0.5 shrink-0 text-fg-muted">
        {isReply ? (
          <CornerDownRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : tp.channel === "linkedin" ? (
          <LinkedinIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        ) : tp.channel === "email" ? (
          <Mail className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-fg">
          {tp.messagePreview}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-fg-muted">
          <span>{formatRelative(tp.sentAt, now)}</span>
          {stakeholder && <span>· {stakeholder.name}</span>}
        </div>
      </div>
      {isReply && (
        <MessageSquareReply className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      )}
    </li>
  );
}
