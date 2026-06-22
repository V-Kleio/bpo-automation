"use client";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { useStore, selectCompany, selectStakeholdersFor, selectCampaign } from "@/lib/store";
import { ScoreGauge } from "./ScoreGauge";
import { QualificationChecklist } from "./QualificationChecklist";
import { PartnershipPanel } from "./PartnershipPanel";
import { GeneratedMessages } from "./GeneratedMessages";
import { AskAIChat } from "./AskAIChat";
import { AnalyzedRail } from "./AnalyzedRail";
import { TierBadge } from "@/components/leads/TierBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResizableColumns } from "@/components/ui/resizable";
import { useLocalStorageState } from "@/lib/hooks/use-local-storage-state";
import { Rocket, Sparkles, FileText, MessagesSquare } from "lucide-react";
import { toast } from "sonner";

// Shared min/max bounds for the workbench's two resizable side panels.
const RAIL = { min: 180, max: 480 };
const CHAT = { min: 320, max: 720 };

export function IntelligenceWorkbench() {
  const searchParams = useSearchParams();
  const fromQuery = searchParams?.get("companyId") ?? null;
  const companies = useStore((s) => s.companies);
  const analyzedFirst = useMemo(
    () =>
      companies
        .filter((c) => c.analysis)
        .sort(
          (a, b) =>
            (b.analysis?.priorityScore ?? 0) -
            (a.analysis?.priorityScore ?? 0),
        )[0]?.id ?? null,
    [companies],
  );

  // Persist the last-viewed company so returning to the workbench restores it.
  // A deep link (?companyId=…) still wins via the sync effect below.
  const [selectedId, setSelectedId] = useLocalStorageState<string | null>(
    "intelligence.selectedId",
    fromQuery ?? analyzedFirst,
  );

  // Keep selection in sync with URL or new analyses
  useEffect(() => {
    if (fromQuery && fromQuery !== selectedId) setSelectedId(fromQuery);
  }, [fromQuery, selectedId, setSelectedId]);
  useEffect(() => {
    if (!selectedId && analyzedFirst) setSelectedId(analyzedFirst);
  }, [analyzedFirst, selectedId, setSelectedId]);

  const company = useStore((s) =>
    selectedId ? selectCompany(selectedId)(s) : undefined,
  );
  const stakeholders = useStore(
    useShallow((s) =>
      selectedId ? selectStakeholdersFor(selectedId)(s) : [],
    ),
  );
  const inCampaign = useStore((s) =>
    selectedId ? !!selectCampaign(selectedId)(s) : false,
  );
  const pushToCampaign = useStore((s) => s.pushToCampaign);
  const log = useStore((s) => s.log);

  function handlePush() {
    if (!company) return;
    pushToCampaign(company.id);
    log({
      layer: 3,
      type: "stage_change",
      summary: `${company.name} moved to campaign queue (Step 1: Operational Champion)`,
      companyId: company.id,
    });
    toast.success(`${company.name} pushed to Layer 3 campaign queue`, {
      action: {
        label: "Open Campaigns",
        onClick: () => (window.location.href = "/campaigns"),
      },
    });
  }

  if (!company || !company.analysis) {
    return (
      <ResizableColumns
        storageKey="intelligence-workbench-layout"
        panels={[
          {
            size: 260,
            ...RAIL,
            content: (
              <aside className="h-full overflow-y-auto bg-zinc-50/50">
                <AnalyzedRail selectedId={selectedId} onSelect={setSelectedId} />
              </aside>
            ),
          },
          {
            size: null,
            content: (
              <div className="flex h-full items-center justify-center p-12">
                <div className="max-w-md rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
                  <Sparkles className="mx-auto mb-3 h-6 w-6 text-zinc-400" />
                  <h2 className="text-base font-semibold text-zinc-900">
                    No analyzed company selected
                  </h2>
                  <p className="mt-2 text-sm text-zinc-500">
                    Go to the Lead Database, select one or more companies, and
                    click
                    <span className="mx-1 font-medium text-zinc-700">
                      Run AI Analysis
                    </span>
                    to populate this workbench.
                  </p>
                  <a
                    href="/leads"
                    className="mt-4 inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
                  >
                    Go to Leads
                  </a>
                </div>
              </div>
            ),
          },
          {
            size: 420,
            ...CHAT,
            content: (
              <aside className="h-full">
                <AskAIChat companyId={selectedId} />
              </aside>
            ),
          },
        ]}
      />
    );
  }

  return (
    <ResizableColumns
      storageKey="intelligence-workbench-layout"
      panels={[
        {
          size: 260,
          ...RAIL,
          content: (
            <aside className="h-full overflow-y-auto bg-zinc-50/50">
              <AnalyzedRail selectedId={selectedId} onSelect={setSelectedId} />
            </aside>
          ),
        },
        {
          size: null,
          content: (
            <div className="h-full overflow-y-auto">
              <div className="px-6 py-6 space-y-6">
          {/* Header card */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-zinc-900">
                    {company.name}
                  </h2>
                  <TierBadge tier={company.tier} />
                  {inCampaign && (
                    <Badge variant="success">In Campaign</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-zinc-600">
                  {company.industry.join(" · ")} · {company.headcount.toLocaleString()} employees · {company.hq}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-zinc-700">
                  {company.whyTarget}
                </p>
              </div>
              <ScoreGauge score={company.analysis.priorityScore} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4">
              <Button
                variant={inCampaign ? "subtle" : "accent"}
                size="md"
                onClick={handlePush}
                disabled={inCampaign}
              >
                <Rocket className="h-4 w-4" />
                {inCampaign ? "Already in Campaign" : "Push to Campaign"}
              </Button>
              <span className="text-xs text-zinc-500">
                Launches the 4-step stakeholder sequence in Layer 3.
              </span>
            </div>
          </div>

          {/* Qualification */}
          <section>
            <SectionHeader
              icon={FileText}
              title="Qualification Checklist"
              subline="Five dimensions evaluated against Wiz.AI's ICP and the company's signals."
            />
            <QualificationChecklist
              qualification={company.analysis.qualification}
            />
          </section>

          {/* Partnership */}
          <section>
            <SectionHeader
              icon={FileText}
              title="Partnership Analysis"
              subline="How a partnership with Wiz.AI plays out — strategic fit, readiness, growth path, localization."
            />
            <PartnershipPanel partnership={company.analysis.partnership} />
          </section>

          {/* Messages */}
          <section>
            <SectionHeader
              icon={MessagesSquare}
              title="AI-Generated Outreach"
              subline="4-step sequence drafted per stakeholder — LinkedIn DM + Email side-by-side."
            />
            <GeneratedMessages
              messages={company.analysis.generatedMessages}
              stakeholders={stakeholders}
            />
          </section>
              </div>
            </div>
          ),
        },
        {
          size: 420,
          ...CHAT,
          content: (
            <aside className="h-full">
              <AskAIChat companyId={selectedId} />
            </aside>
          ),
        },
      ]}
    />
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subline,
}: {
  icon: typeof Rocket;
  title: string;
  subline: string;
}) {
  return (
    <div className="mb-3 flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <p className="text-xs text-zinc-500">{subline}</p>
      </div>
    </div>
  );
}
