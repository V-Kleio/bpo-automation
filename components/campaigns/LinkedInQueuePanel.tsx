"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Play,
  ListPlus,
  Trash2,
  Clock,
  Send,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { uid, formatRelative } from "@/lib/utils";
import { recordDealActivity } from "@/lib/mock/crm-sync";
import { STEP_TO_ROLE, type Touchpoint } from "@/lib/types";
import { getClientConfig } from "@/lib/services/public-config-client";
import { truncateNote } from "@/lib/services/linkedin/types";
import { cn } from "@/lib/utils";

interface QueueItem {
  id: string;
  companyId: string;
  stakeholderId: string;
  step: 1 | 2 | 3 | 4;
  kind: "connect" | "dm";
  firstName: string;
  status: "pending" | "sending" | "sent" | "failed";
  enqueuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  externalId?: string;
  error?: string;
}

interface QueueSnapshot {
  running: boolean;
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  nextAtIso: string | null;
  dailyUsage: number;
  dailyCap: number;
  remaining: number;
  items: QueueItem[];
}

export function LinkedInQueuePanel() {
  const campaigns = useStore((s) => s.campaigns);
  const companies = useStore((s) => s.companies);
  const stakeholders = useStore((s) => s.stakeholders);
  const appendTouchpoint = useStore((s) => s.appendTouchpoint);
  const updateCampaignStage = useStore((s) => s.updateCampaignStage);
  const log = useStore((s) => s.log);

  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null);
  const [linkedinLive, setLinkedinLive] = useState(false);
  const [enqueueing, setEnqueueing] = useState(false);
  const [statusStale, setStatusStale] = useState(false);
  const claimedIdsRef = useRef<Set<string>>(new Set());
  const [confirm, confirmDialog] = useConfirm();

  // Identify pending stakeholders that can be auto-queued: those in active
  // campaigns whose active step's stakeholder has a LinkedIn URL and no
  // connection request yet.
  const candidates = useMemo(() => {
    const out: Array<{
      companyId: string;
      companyName: string;
      stakeholderId: string;
      firstName: string;
      profileUrl: string;
      step: 1 | 2 | 3 | 4;
      note: string;
    }> = [];
    for (const camp of campaigns) {
      if (
        camp.stage === "meeting_booked" ||
        camp.stage === "disqualified"
      )
        continue;
      const company = companies.find((c) => c.id === camp.companyId);
      if (!company) continue;
      const role = STEP_TO_ROLE[camp.activeStep];
      const sh = stakeholders.find(
        (s) => s.companyId === camp.companyId && s.role === role,
      );
      if (!sh || !sh.linkedinUrl) continue;
      const alreadySent = camp.touchpoints.some(
        (t) =>
          t.stakeholderId === sh.id &&
          t.type === "connection_request",
      );
      if (alreadySent) continue;
      const first = sh.name.split(" ")[0] ?? sh.name;
      const msg = company.analysis?.generatedMessages.find(
        (m) => m.stakeholderId === sh.id && m.channel === "linkedin",
      );
      const note = truncateNote(
        msg?.body ??
          `Hi ${first} — open to a quick chat about reducing manual agent workload at ${company.name}?`,
      );
      out.push({
        companyId: company.id,
        companyName: company.name,
        stakeholderId: sh.id,
        firstName: first,
        profileUrl: sh.linkedinUrl,
        step: camp.activeStep,
        note,
      });
    }
    return out;
  }, [campaigns, companies, stakeholders]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/linkedin/queue/status", {
        cache: "no-store",
      });
      if (!res.ok) {
        setStatusStale(true);
        return;
      }
      const data = (await res.json()) as QueueSnapshot;
      setStatusStale(false);
      setSnapshot(data);

      // For each item we previously enqueued that has reached a terminal
      // state, append the touchpoint locally (once per item).
      const claimed = claimedIdsRef.current;
      for (const item of data.items) {
        if (claimed.has(item.id)) continue;
        if (item.status === "sent") {
          claimed.add(item.id);
          const nowIso = item.finishedAt ?? new Date().toISOString();
          const preview = `LinkedIn ${item.kind === "connect" ? "connection request" : "DM"} sent to ${item.firstName} (queued).`;
          const tp: Touchpoint = {
            id: item.externalId ?? uid("tp"),
            stakeholderId: item.stakeholderId,
            channel: "linkedin",
            type: item.kind === "connect" ? "connection_request" : "dm",
            sentAt: nowIso,
            status: "delivered",
            step: item.step,
            messagePreview: preview,
          };
          appendTouchpoint(item.companyId, tp);
          log({
            layer: 3,
            type: "channel_send",
            summary: preview,
            companyId: item.companyId,
            at: nowIso,
            meta: {
              provider: "queue",
              kind: item.kind,
              externalId: item.externalId,
            },
          });
          recordDealActivity(item.companyId, {
            id: uid("act"),
            at: nowIso,
            type: "touchpoint",
            summary: preview,
          });
          if (item.kind === "connect") {
            updateCampaignStage(
              item.companyId,
              "connection_sent",
              nowIso,
            );
          }
        } else if (item.status === "failed") {
          claimed.add(item.id);
          log({
            layer: 3,
            type: "channel_send",
            summary: `LinkedIn ${item.kind} failed for ${item.firstName}: ${item.error ?? "unknown"}`,
            companyId: item.companyId,
            at: item.finishedAt ?? new Date().toISOString(),
            meta: {
              provider: "queue",
              kind: item.kind,
              error: item.error,
            },
          });
        }
      }
    } catch {
      setStatusStale(true);
    }
  }, [appendTouchpoint, log, updateCampaignStage]);

  useEffect(() => {
    getClientConfig()
      .then((cfg) =>
        setLinkedinLive(
          cfg.linkedin.provider !== "mock" && cfg.linkedin.authenticated,
        ),
      )
      .catch(() => setLinkedinLive(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  async function sendAllPending() {
    if (!linkedinLive) {
      toast.error("Connect LinkedIn before queueing sends.");
      return;
    }
    if (candidates.length === 0) {
      toast.info("No pending LinkedIn invites to send.");
      return;
    }
    setEnqueueing(true);
    try {
      const items = candidates.map((c) => ({
        companyId: c.companyId,
        stakeholderId: c.stakeholderId,
        step: c.step,
        kind: "connect" as const,
        profileUrl: c.profileUrl,
        firstName: c.firstName,
        note: c.note,
      }));
      const res = await fetch("/api/linkedin/queue/enqueue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = (await res.json()) as {
        enqueued?: string[];
        skipped?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error("Could not enqueue invites", { description: data.error });
        return;
      }
      const n = data.enqueued?.length ?? 0;
      if (n === 0) {
        toast.info("Nothing new to queue", {
          description: data.skipped
            ? `${data.skipped} already in flight or sent.`
            : undefined,
        });
      } else {
        toast.success(
          `Queued ${n} LinkedIn invite${n === 1 ? "" : "s"}`,
          {
            description:
              data.skipped && data.skipped > 0
                ? `${data.skipped} skipped (already queued).`
                : "Worker is pacing sends based on the configured delay.",
          },
        );
      }
      refresh();
    } catch (err) {
      toast.error("Failed to enqueue invites", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setEnqueueing(false);
    }
  }

  async function clearFinished() {
    const res = await fetch("/api/linkedin/queue/clear", { method: "POST" });
    if (!res.ok) {
      toast.error("Failed to clear queue history");
      return;
    }
    refresh();
  }

  async function clearAll() {
    const pending = snapshot?.pending ?? 0;
    const ok = await confirm({
      title: "Cancel pending sends?",
      description: `${pending} queued LinkedIn invite${pending === 1 ? "" : "s"} will be removed from the queue. Sends already in flight or completed are unaffected.`,
      confirmLabel: "Cancel pending",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch("/api/linkedin/queue/clear?scope=all", {
      method: "POST",
    });
    if (!res.ok) {
      toast.error("Failed to cancel pending sends");
      return;
    }
    refresh();
  }

  async function retryFailedSends() {
    // Un-claim failed items so their next terminal state is re-processed
    // (a retried item that later succeeds must still record its touchpoint).
    const failedIds = (snapshot?.items ?? [])
      .filter((i) => i.status === "failed")
      .map((i) => i.id);
    if (failedIds.length === 0) return;
    for (const id of failedIds) claimedIdsRef.current.delete(id);
    try {
      const res = await fetch("/api/linkedin/queue/retry", { method: "POST" });
      const data = (await res.json()) as {
        retried?: string[];
        error?: string;
      };
      if (!res.ok) {
        toast.error("Could not retry failed sends", {
          description: data.error,
        });
        return;
      }
      const n = data.retried?.length ?? 0;
      toast.success(`Retrying ${n} failed send${n === 1 ? "" : "s"}`, {
        description: "Worker is re-pacing the queue.",
      });
      refresh();
    } catch (err) {
      toast.error("Failed to retry sends", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (campaigns.length === 0) return null;

  const totalInFlight =
    (snapshot?.pending ?? 0) + (snapshot?.sending ?? 0);
  const showPanel = totalInFlight > 0 || (snapshot?.sent ?? 0) > 0 || (snapshot?.failed ?? 0) > 0;

  const nearCapThreshold = snapshot
    ? Math.max(3, Math.ceil(snapshot.dailyCap * 0.2))
    : 0;
  const nearCap =
    linkedinLive && snapshot != null && snapshot.remaining <= nearCapThreshold;

  return (
    <div className="mb-3 flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3">
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <Send className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              LinkedIn send queue
              {statusStale && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                  status unavailable — retrying…
                </span>
              )}
            </div>
            <div className="text-[11px] text-zinc-500">
              {linkedinLive
                ? candidates.length === 0 && totalInFlight === 0
                  ? "All active campaigns have connection requests sent."
                  : `${candidates.length} eligible · paced ${snapshot ? `${snapshot.dailyUsage}/${snapshot.dailyCap} today` : ""}`
                : "Connect LinkedIn before bulk-sending."}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {nearCap && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium",
                snapshot!.remaining <= 0
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-amber-200 bg-amber-50 text-amber-700",
              )}
              title="LinkedIn daily send cap"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {snapshot!.remaining <= 0
                ? "Daily cap reached"
                : `${snapshot!.remaining} send${snapshot!.remaining === 1 ? "" : "s"} left today`}
            </span>
          )}
          {(snapshot?.failed ?? 0) > 0 && (
            <Button variant="outline" size="sm" onClick={retryFailedSends}>
              <RotateCcw className="h-3.5 w-3.5" />
              Retry failed ({snapshot!.failed})
            </Button>
          )}
          {totalInFlight > 0 && (
            <Button variant="outline" size="sm" onClick={clearAll}>
              <Trash2 className="h-3.5 w-3.5" />
              Cancel pending
            </Button>
          )}
          {(snapshot?.sent ?? 0) + (snapshot?.failed ?? 0) > 0 && (
            <Button variant="outline" size="sm" onClick={clearFinished}>
              Clear history
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={sendAllPending}
            disabled={
              !linkedinLive || enqueueing || candidates.length === 0
            }
            title={
              !linkedinLive
                ? "Connect LinkedIn to enable bulk send"
                : candidates.length === 0
                  ? "No pending invites"
                  : "Queue all pending LinkedIn connection requests"
            }
          >
            {enqueueing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ListPlus className="h-3.5 w-3.5" />
            )}
            Send all pending ({candidates.length})
          </Button>
        </div>
      </div>

      {showPanel && snapshot && (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-600">
          <Stat
            label="Queued"
            value={snapshot.pending}
            tone="amber"
            icon={<Clock className="h-3 w-3" />}
          />
          <Stat
            label="Sending"
            value={snapshot.sending}
            tone="blue"
            icon={<Play className="h-3 w-3" />}
          />
          <Stat label="Sent" value={snapshot.sent} tone="emerald" />
          {snapshot.failed > 0 && (
            <Stat label="Failed" value={snapshot.failed} tone="rose" />
          )}
          {snapshot.nextAtIso && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-600">
              <Clock className="h-3 w-3" />
              Next send {formatRelative(snapshot.nextAtIso)}
            </span>
          )}
        </div>
      )}

      {snapshot && snapshot.items.some((i) => i.status === "failed") && (
        <FailedItemsLog items={snapshot.items.filter((i) => i.status === "failed")} />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "amber" | "blue" | "emerald" | "rose";
  icon?: React.ReactNode;
}) {
  const TONE: Record<typeof tone, string> = {
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium",
        TONE[tone],
      )}
    >
      {icon}
      {value} {label}
    </span>
  );
}

function FailedItemsLog({ items }: { items: QueueItem[] }) {
  // Show the most recent failures first, capped so the panel doesn't
  // explode if many invites fail in a row.
  const recent = items.slice(-5).reverse();
  return (
    <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2">
      <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-rose-700">
        <AlertTriangle className="h-3 w-3" />
        Recent failures ({items.length})
      </div>
      <ul className="flex flex-col gap-1">
        {recent.map((item) => (
          <li
            key={item.id}
            className="rounded border border-rose-200 bg-white px-2 py-1 text-[11px]"
          >
            <div className="font-medium text-rose-800">
              {item.firstName} · step {item.step} ·{" "}
              {item.kind === "connect" ? "connection request" : "DM"}
            </div>
            <div className="mt-0.5 break-words text-rose-700">
              {item.error ?? "unknown error"}
            </div>
            {item.finishedAt && (
              <div className="mt-0.5 text-[10px] text-rose-500">
                {formatRelative(item.finishedAt)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
