"use client";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/utils";
import type { DealActivity, DealStage } from "@/lib/types";

const AES = [
  "Putri Wijaya",
  "Daniel Tanudjaja",
  "Maya Pertiwi",
  "Rangga Anggara",
];

function assignAE(companyId: string): string {
  let h = 0;
  for (let i = 0; i < companyId.length; i++) h = (h * 33) ^ companyId.charCodeAt(i);
  return AES[Math.abs(h) % AES.length];
}

export function syncDealFromStage(
  companyId: string,
  dealStage: DealStage,
  nowIso: string,
): void {
  const store = useStore.getState();
  const company = store.companies.find((c) => c.id === companyId);
  if (!company) return;

  store.upsertDeal({
    companyId,
    stage: dealStage,
    assignedAE: assignAE(companyId),
    amount: estimateAmount(company.tier),
    notifiedAt: dealStage === "meeting_scheduled" ? nowIso : undefined,
  });

  store.log({
    layer: 4,
    type: "crm_sync",
    summary: `HubSpot: deal for ${company.name} synced to "${dealStage}"`,
    companyId,
    at: nowIso,
  });
}

export function recordDealActivity(
  companyId: string,
  activity: DealActivity,
): void {
  useStore.getState().appendDealActivity(companyId, activity);
}

function estimateAmount(tier: "priority" | "warm" | "nurture"): number {
  if (tier === "priority") return 80000 + Math.floor(Math.random() * 70000);
  if (tier === "warm") return 25000 + Math.floor(Math.random() * 30000);
  return 8000 + Math.floor(Math.random() * 12000);
}

export function addManualDealNote(companyId: string, summary: string): void {
  recordDealActivity(companyId, {
    id: uid("act"),
    at: new Date().toISOString(),
    type: "note",
    summary,
  });
}
