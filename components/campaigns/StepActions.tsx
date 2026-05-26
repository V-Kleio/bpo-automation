"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Send, MessageSquareReply, Loader2 } from "lucide-react";
import { LinkedinIcon } from "@/components/ui/icons";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/utils";
import { recordDealActivity, syncDealFromStage } from "@/lib/mock/crm-sync";
import type {
  CampaignLead,
  Company,
  GeneratedMessage,
  Stakeholder,
  Touchpoint,
} from "@/lib/types";

type SendKind = "connect" | "dm";

function findMessage(
  company: Company,
  stakeholderId: string,
  channel: "linkedin" | "email",
): GeneratedMessage | undefined {
  return company.analysis?.generatedMessages.find(
    (m) => m.stakeholderId === stakeholderId && m.channel === channel,
  );
}

export function StepActions({
  company,
  campaign,
  stakeholder,
  step,
  linkedinIsLive,
}: {
  company: Company;
  campaign: CampaignLead;
  stakeholder: Stakeholder;
  step: 1 | 2 | 3 | 4;
  linkedinIsLive: boolean;
}) {
  const appendTouchpoint = useStore((s) => s.appendTouchpoint);
  const updateCampaignStage = useStore((s) => s.updateCampaignStage);
  const setActiveStep = useStore((s) => s.setActiveStep);
  const log = useStore((s) => s.log);
  const [busy, setBusy] = useState<null | "connect" | "dm" | "email" | "reply">(
    null,
  );

  const linkedinMessage = findMessage(company, stakeholder.id, "linkedin");
  const emailMessage = findMessage(company, stakeholder.id, "email");
  const hasAnalysis = !!company.analysis;
  const hasLinkedinUrl = !!stakeholder.linkedinUrl;
  const hasEmail = !!stakeholder.email;

  const touchpointsForStep = campaign.touchpoints.filter(
    (t) => t.stakeholderId === stakeholder.id,
  );
  const connectionSent = touchpointsForStep.some(
    (t) => t.type === "connection_request",
  );
  const dmSent = touchpointsForStep.some((t) => t.type === "dm");
  const emailSent = touchpointsForStep.some((t) => t.type === "email");
  const repliedAlready = touchpointsForStep.some(
    (t) => t.type === "reply_received",
  );

  async function sendLinkedIn(kind: SendKind) {
    if (!stakeholder.linkedinUrl) return;
    if (!linkedinMessage && !hasAnalysis) {
      toast.warning("Run AI analysis first to generate messages.");
      return;
    }
    setBusy(kind);
    const nowIso = new Date().toISOString();
    const first = stakeholder.name.split(" ")[0] ?? stakeholder.name;
    const body =
      linkedinMessage?.body ??
      `Hi ${first} — open to a quick chat about reducing manual agent workload at ${company.name}?`;
    const note = body.slice(0, 280);

    try {
      const res = await fetch("/api/linkedin/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          profileUrl: stakeholder.linkedinUrl,
          firstName: first,
          note: kind === "connect" ? note : undefined,
          body: kind === "dm" ? body : undefined,
        }),
      });
      const data = (await res.json()) as {
        success: boolean;
        provider: string;
        externalId?: string;
        error?: string;
        rateLimited?: boolean;
      };

      if (!res.ok || !data.success) {
        toast.error(
          data.rateLimited
            ? "LinkedIn daily cap reached"
            : `LinkedIn ${kind} failed`,
          { description: data.error },
        );
        return;
      }

      const preview =
        kind === "connect"
          ? `[${data.provider}] Sent LinkedIn connection request to ${first} (${stakeholder.title}).`
          : `[${data.provider}] LinkedIn DM to ${first}: "${body.slice(0, 80)}${body.length > 80 ? "…" : ""}"`;

      const tp: Touchpoint = {
        id: data.externalId ?? uid("tp"),
        stakeholderId: stakeholder.id,
        channel: "linkedin",
        type: kind === "connect" ? "connection_request" : "dm",
        sentAt: nowIso,
        status: "delivered",
        step,
        messagePreview: preview,
      };
      appendTouchpoint(company.id, tp);
      log({
        layer: 3,
        type: "channel_send",
        summary: preview,
        companyId: company.id,
        at: nowIso,
        meta: {
          provider: data.provider,
          kind,
          externalId: data.externalId,
        },
      });
      recordDealActivity(company.id, {
        id: uid("act"),
        at: nowIso,
        type: "touchpoint",
        summary: preview,
      });

      // Stage progression: connection sent moves queued → connection_sent.
      if (kind === "connect" && campaign.stage === "queued") {
        updateCampaignStage(company.id, "connection_sent", nowIso);
      }
      toast.success(
        kind === "connect"
          ? "Connection request sent"
          : "LinkedIn DM sent",
        { description: `${first} · via ${data.provider}` },
      );
    } catch (err) {
      toast.error(`LinkedIn ${kind} failed`, {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(null);
    }
  }

  function sendEmail() {
    if (!hasEmail) return;
    if (!emailMessage && !hasAnalysis) {
      toast.warning("Run AI analysis first to generate email content.");
      return;
    }
    setBusy("email");
    const nowIso = new Date().toISOString();
    const first = stakeholder.name.split(" ")[0] ?? stakeholder.name;
    const subject =
      emailMessage?.subject ?? `Quick note re ${company.name}`;
    const preview = `Email to ${first}: "${subject}" (simulated)`;
    const tp: Touchpoint = {
      id: uid("tp"),
      stakeholderId: stakeholder.id,
      channel: "email",
      type: "email",
      sentAt: nowIso,
      status: "delivered",
      step,
      messagePreview: preview,
    };
    appendTouchpoint(company.id, tp);
    log({
      layer: 3,
      type: "channel_send",
      summary: preview,
      companyId: company.id,
      at: nowIso,
      meta: { provider: "mock", channel: "email" },
    });
    recordDealActivity(company.id, {
      id: uid("act"),
      at: nowIso,
      type: "touchpoint",
      summary: preview,
    });
    if (campaign.stage === "queued" || campaign.stage === "connection_sent") {
      updateCampaignStage(company.id, "email_sequence_active", nowIso);
    }
    toast.info(`Simulated email logged for ${first}`);
    setBusy(null);
  }

  function markReplied() {
    setBusy("reply");
    const nowIso = new Date().toISOString();
    const first = stakeholder.name.split(" ")[0] ?? stakeholder.name;
    const preview = `${first} replied (manually marked).`;
    const tp: Touchpoint = {
      id: uid("tp"),
      stakeholderId: stakeholder.id,
      channel: "linkedin",
      type: "reply_received",
      sentAt: nowIso,
      status: "replied",
      step,
      messagePreview: preview,
    };
    appendTouchpoint(company.id, tp);
    log({
      layer: 3,
      type: "reply",
      summary: preview,
      companyId: company.id,
      at: nowIso,
    });
    recordDealActivity(company.id, {
      id: uid("act"),
      at: nowIso,
      type: "reply",
      summary: preview,
    });
    updateCampaignStage(company.id, "replied", nowIso);
    syncDealFromStage(company.id, "engaged", nowIso);
    const nextStep = Math.min(4, step + 1) as 1 | 2 | 3 | 4;
    if (nextStep !== campaign.activeStep) {
      setActiveStep(company.id, nextStep);
    }
    toast.success(`Marked ${first} as replied`, {
      description:
        nextStep !== step ? `Active step advanced to ${nextStep}` : undefined,
    });
    setBusy(null);
  }

  if (campaign.stage === "meeting_booked" || campaign.stage === "disqualified") {
    return null;
  }

  return (
    <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50/60 p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Actions
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="accent"
          size="sm"
          disabled={
            busy !== null ||
            !hasLinkedinUrl ||
            connectionSent ||
            repliedAlready
          }
          onClick={() => sendLinkedIn("connect")}
          title={
            !hasLinkedinUrl
              ? "No LinkedIn URL for this stakeholder"
              : connectionSent
                ? "Connection request already sent"
                : linkedinIsLive
                  ? "Sends a real LinkedIn connection request via the active provider"
                  : "Simulated (no real LinkedIn provider connected)"
          }
        >
          {busy === "connect" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LinkedinIcon className="h-3.5 w-3.5" />
          )}
          {connectionSent ? "Connection sent" : "Send connection"}
          {!linkedinIsLive && !connectionSent && (
            <span className="text-[10px] opacity-70">(sim)</span>
          )}
        </Button>

        <Button
          variant="primary"
          size="sm"
          disabled={busy !== null || !hasLinkedinUrl || repliedAlready}
          onClick={() => sendLinkedIn("dm")}
          title={
            !hasLinkedinUrl
              ? "No LinkedIn URL for this stakeholder"
              : linkedinIsLive
                ? "Sends a real LinkedIn DM via the active provider"
                : "Simulated (no real LinkedIn provider connected)"
          }
        >
          {busy === "dm" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {dmSent ? "Send another DM" : "Send LinkedIn DM"}
          {!linkedinIsLive && (
            <span className="text-[10px] opacity-70">(sim)</span>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null || !hasEmail || repliedAlready}
          onClick={sendEmail}
          title={
            !hasEmail
              ? "No email for this stakeholder"
              : "Email is always simulated — appends a logged touchpoint."
          }
        >
          {busy === "email" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mail className="h-3.5 w-3.5" />
          )}
          {emailSent ? "Send another email" : "Send email"}
          <span className="text-[10px] opacity-70">(sim)</span>
        </Button>

        {!repliedAlready && (
          <Button
            variant="success"
            size="sm"
            disabled={busy !== null}
            onClick={markReplied}
          >
            {busy === "reply" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <MessageSquareReply className="h-3.5 w-3.5" />
            )}
            Mark replied
          </Button>
        )}
      </div>
    </div>
  );
}
