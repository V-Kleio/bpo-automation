"use client";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CalendarCheck, Ban } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/utils";
import { recordDealActivity, syncDealFromStage } from "@/lib/mock/crm-sync";
import type { CampaignLead, Company } from "@/lib/types";

export function CampaignTerminalActions({
  company,
  campaign,
}: {
  company: Company;
  campaign: CampaignLead;
}) {
  const updateCampaignStage = useStore((s) => s.updateCampaignStage);
  const log = useStore((s) => s.log);
  const [confirm, confirmDialog] = useConfirm();

  const terminal =
    campaign.stage === "meeting_booked" || campaign.stage === "disqualified";

  function markMeetingBooked() {
    const nowIso = new Date().toISOString();
    updateCampaignStage(company.id, "meeting_booked", nowIso);
    syncDealFromStage(company.id, "meeting_scheduled", nowIso);
    log({
      layer: 3,
      type: "notification",
      summary: `Meeting booked with ${company.name} — sales team notified`,
      companyId: company.id,
      at: nowIso,
    });
    recordDealActivity(company.id, {
      id: uid("act"),
      at: nowIso,
      type: "stage_change",
      summary: "Meeting booked",
    });
    toast.success(`Meeting booked with ${company.name}`);
  }

  async function disqualify() {
    const ok = await confirm({
      title: `Disqualify ${company.name}?`,
      description:
        "The campaign moves to a terminal state and the linked deal is marked closed-lost. This can't be undone from here.",
      confirmLabel: "Disqualify",
      destructive: true,
    });
    if (!ok) return;
    const nowIso = new Date().toISOString();
    updateCampaignStage(company.id, "disqualified", nowIso);
    syncDealFromStage(company.id, "closed_lost", nowIso);
    log({
      layer: 3,
      type: "stage_change",
      summary: `${company.name} disqualified`,
      companyId: company.id,
      at: nowIso,
    });
    recordDealActivity(company.id, {
      id: uid("act"),
      at: nowIso,
      type: "stage_change",
      summary: "Campaign disqualified",
    });
    toast.info(`${company.name} disqualified`);
  }

  if (terminal) {
    return (
      <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-fg-muted">
        Campaign is in a terminal state. No further actions available.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {confirmDialog}
      <Button variant="success" size="sm" onClick={markMeetingBooked}>
        <CalendarCheck className="h-3.5 w-3.5" />
        Mark meeting booked
      </Button>
      <Button variant="danger" size="sm" onClick={disqualify}>
        <Ban className="h-3.5 w-3.5" />
        Disqualify
      </Button>
    </div>
  );
}
