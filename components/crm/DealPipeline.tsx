"use client";
import { useState } from "react";
import { useStore, selectCompany } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { DEAL_STAGE_LABEL, type DealStage } from "@/lib/types";
import { TierBadge } from "@/components/leads/TierBadge";
import { ActivityDrawer } from "./ActivityDrawer";
import { formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { CircleDollarSign, User } from "lucide-react";

const STAGE_ORDER: DealStage[] = [
  "new",
  "engaged",
  "qualified_opportunity",
  "meeting_scheduled",
  "closed_won",
  "closed_lost",
];

const STAGE_TONE: Record<DealStage, string> = {
  new: "border-zinc-300 bg-zinc-50",
  engaged: "border-blue-300 bg-blue-50",
  qualified_opportunity: "border-indigo-300 bg-indigo-50",
  meeting_scheduled: "border-emerald-300 bg-emerald-50",
  closed_won: "border-emerald-400 bg-emerald-100",
  closed_lost: "border-zinc-300 bg-zinc-100",
};

export function DealPipeline() {
  const deals = useStore((s) => s.deals);
  const now = useStore((s) => s.clock.simulatedTime);
  const [openId, setOpenId] = useState<string | null>(null);

  if (deals.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500">
        No deals yet. Push a qualified company through the campaign and Layer 4
        will sync them here automatically.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-3 pb-2">
          {STAGE_ORDER.map((stage) => {
            const items = deals.filter((d) => d.stage === stage);
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
                    <div className="text-xs font-semibold text-zinc-900">
                      {DEAL_STAGE_LABEL[stage]}
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {items.length}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-600">
                    ${(total / 1000).toFixed(0)}k pipeline
                  </div>
                </div>
                <div className="space-y-2">
                  {items.length === 0 && (
                    <div className="rounded-md border border-dashed border-zinc-200 bg-white/40 px-3 py-4 text-center text-[11px] text-zinc-400">
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
      className="block w-full rounded-md border border-zinc-200 bg-white p-3 text-left shadow-sm transition-all hover:border-zinc-300 hover:shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900">
            {company.name}
          </div>
          <div className="mt-0.5 truncate text-[10px] text-zinc-500">
            {company.industry[0]}
          </div>
        </div>
        <TierBadge tier={company.tier} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="inline-flex items-center gap-1 font-semibold text-zinc-900">
          <CircleDollarSign className="h-3 w-3 text-zinc-500" />
          {amount ? `$${(amount / 1000).toFixed(0)}k` : "—"}
        </span>
        {assignedAE && (
          <span className="inline-flex items-center gap-1 text-zinc-500">
            <User className="h-3 w-3" />
            {assignedAE.split(" ")[0]}
          </span>
        )}
      </div>
      <div className="mt-1 text-[10px] text-zinc-500">
        {lastActivityAt ? `Last activity ${formatRelative(lastActivityAt, now)}` : "No activity"}
      </div>
    </button>
  );
}
