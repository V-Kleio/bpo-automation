"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { CompanyCard } from "./CompanyCard";
import { StageBadge, STAGES_ORDERED, STAGE_CONFIG } from "./StageBadge";
import { StakeholderThreadDrawer } from "./StakeholderThreadDrawer";
import type { CampaignStage } from "@/lib/types";

export function KanbanBoard() {
  const campaigns = useStore((s) => s.campaigns);
  const now = useStore((s) => s.clock.simulatedTime);
  const [openId, setOpenId] = useState<string | null>(null);

  const byStage = useMemo(() => {
    const map = new Map<CampaignStage, typeof campaigns>();
    for (const stage of STAGES_ORDERED) map.set(stage, []);
    for (const c of campaigns) {
      map.get(c.stage)?.push(c);
    }
    return map;
  }, [campaigns]);

  if (campaigns.length === 0) {
    return (
      <>
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-12 text-center">
          <h3 className="text-base font-semibold text-zinc-900">
            No active campaigns
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            Push a qualified company from the AI Intelligence workbench to
            create a campaign card here.
          </p>
          <a
            href="/intelligence"
            className="mt-4 inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Go to AI Intelligence
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-3 pb-2">
          {STAGES_ORDERED.map((stage) => {
            const items = byStage.get(stage) ?? [];
            const cfg = STAGE_CONFIG[stage];
            return (
              <div key={stage} className="w-72 shrink-0">
                <div className="mb-2 flex items-center justify-between">
                  <StageBadge stage={stage} />
                  <span className="text-[11px] font-medium text-zinc-500">
                    {items.length}
                  </span>
                </div>
                <div
                  className={
                    "min-h-[160px] rounded-lg border border-zinc-200 bg-zinc-50/60 p-2 space-y-2"
                  }
                >
                  {items.length === 0 && (
                    <div className="rounded-md border border-dashed border-zinc-200 bg-white/40 px-3 py-6 text-center text-[11px] text-zinc-400">
                      Empty
                    </div>
                  )}
                  {items.map((c) => (
                    <CompanyCard
                      key={c.companyId}
                      campaign={c}
                      onOpen={() => setOpenId(c.companyId)}
                      nowIso={now}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <StakeholderThreadDrawer
        companyId={openId}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
