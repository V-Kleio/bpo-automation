"use client";
import { useMemo, useState } from "react";
import { useStore, selectCompany } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { DEAL_STAGE_LABEL, type DealStage } from "@/lib/types";
import { TierBadge } from "@/components/leads/TierBadge";
import { ActivityDrawer } from "./ActivityDrawer";
import { useLocalStorageState } from "@/lib/hooks/use-local-storage-state";
import { formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ArrowUpDown, CircleDollarSign, User } from "lucide-react";

type DealSort = "activity" | "amount" | "name";

const STAGE_ORDER: DealStage[] = [
  "new",
  "engaged",
  "qualified_opportunity",
  "meeting_scheduled",
  "closed_won",
  "closed_lost",
];

const STAGE_TONE: Record<DealStage, string> = {
  new: "border-border-strong bg-surface-2",
  engaged: "border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40",
  qualified_opportunity: "border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40",
  meeting_scheduled: "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40",
  closed_won: "border-emerald-400 bg-emerald-100 dark:bg-emerald-900/40",
  closed_lost: "border-border-strong bg-surface-2",
};

export function DealPipeline() {
  const deals = useStore((s) => s.deals);
  const companies = useStore((s) => s.companies);
  const now = useStore((s) => s.clock.simulatedTime);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sort, setSort] = useLocalStorageState<DealSort>(
    "crm.dealSort",
    "activity",
  );

  // Resolve company names once for name-based sorting.
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of companies) m.set(c.id, c.name);
    return m;
  }, [companies]);

  const sortDeals = useMemo(() => {
    return (items: typeof deals) =>
      [...items].sort((a, b) => {
        if (sort === "amount") return (b.amount ?? 0) - (a.amount ?? 0);
        if (sort === "name")
          return (nameById.get(a.companyId) ?? "").localeCompare(
            nameById.get(b.companyId) ?? "",
          );
        // activity: most recently touched first ("" sorts last)
        return (b.activities[0]?.at ?? "").localeCompare(
          a.activities[0]?.at ?? "",
        );
      });
  }, [sort, nameById]);

  if (deals.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-strong bg-surface p-12 text-center text-sm text-fg-muted">
        No deals yet. Push a qualified company through the campaign and Layer 4
        will sync them here automatically.
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-end gap-2">
        <label className="flex items-center gap-1.5 text-xs text-fg-muted">
          <ArrowUpDown className="h-3.5 w-3.5 text-fg-subtle" />
          Sort cards by
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as DealSort)}
            className="h-7 text-xs"
          >
            <option value="activity">Recent activity</option>
            <option value="amount">Amount (high → low)</option>
            <option value="name">Company (A → Z)</option>
          </Select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-3 pb-2">
          {STAGE_ORDER.map((stage) => {
            const items = sortDeals(deals.filter((d) => d.stage === stage));
            const total = items.reduce((sum, d) => sum + (d.amount ?? 0), 0);
            return (
              <div key={stage} className="w-72 shrink-0">
                <div
                  className={cn(
                    "mb-2 rounded-lg border px-3 py-2",
                    STAGE_TONE[stage],
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-fg">
                      {DEAL_STAGE_LABEL[stage]}
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {items.length}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-[11px] text-fg-muted">
                    ${(total / 1000).toFixed(0)}k pipeline
                  </div>
                </div>
                <div className="space-y-2">
                  {items.length === 0 && (
                    <div className="rounded-md border border-dashed border-border bg-surface/40 px-3 py-4 text-center text-[11px] text-fg-subtle">
                      —
                    </div>
                  )}
                  {items.map((d) => (
                    <DealCard
                      key={d.id}
                      companyId={d.companyId}
                      amount={d.amount}
                      assignedAE={d.assignedAE}
                      lastActivityAt={d.activities[0]?.at}
                      now={now}
                      onOpen={() => setOpenId(d.companyId)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ActivityDrawer
        companyId={openId}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}

function DealCard({
  companyId,
  amount,
  assignedAE,
  lastActivityAt,
  now,
  onOpen,
}: {
  companyId: string;
  amount?: number;
  assignedAE?: string;
  lastActivityAt?: string;
  now: string;
  onOpen: () => void;
}) {
  const company = useStore((s) => selectCompany(companyId)(s));
  if (!company) return null;
  return (
    <button
      onClick={onOpen}
      className="block w-full rounded-md border border-border bg-surface p-3 text-left shadow-sm transition-all hover:border-border-strong hover:shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-fg">
            {company.name}
          </div>
          <div className="mt-0.5 truncate text-[10px] text-fg-muted">
            {company.industry[0]}
          </div>
        </div>
        <TierBadge tier={company.tier} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="inline-flex items-center gap-1 font-semibold text-fg">
          <CircleDollarSign className="h-3 w-3 text-fg-muted" />
          {amount ? `$${(amount / 1000).toFixed(0)}k` : "—"}
        </span>
        {assignedAE && (
          <span className="inline-flex items-center gap-1 text-fg-muted">
            <User className="h-3 w-3" />
            {assignedAE.split(" ")[0]}
          </span>
        )}
      </div>
      <div className="mt-1 text-[10px] text-fg-muted">
        {lastActivityAt ? `Last activity ${formatRelative(lastActivityAt, now)}` : "No activity"}
      </div>
    </button>
  );
}
