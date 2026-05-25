"use client";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/utils";
import {
  type CampaignLead,
  type CampaignStage,
  type Touchpoint,
} from "@/lib/types";
import { syncDealFromStage, recordDealActivity } from "./crm-sync";
import {
  emitLinkedInAction,
  emitEmailAction,
} from "@/lib/services/outreach-gateway";
import { toast } from "sonner";

const BASE_TICK_MS = 600;
const SIM_MS_PER_TICK_BASE = 15 * 60 * 1000; // 15 simulated minutes per real tick at 1x

// Per-tick transition probabilities (rolled each tick for every non-terminal lead, at 1x speed).
const STAGE_TRANSITIONS: Record<
  CampaignStage,
  Array<{ next: CampaignStage; prob: number }>
> = {
  queued: [{ next: "connection_sent", prob: 0.35 }],
  connection_sent: [
    { next: "email_sequence_active", prob: 0.3 },
    { next: "disqualified", prob: 0.04 },
  ],
  email_sequence_active: [
    { next: "replied", prob: 0.22 },
    { next: "disqualified", prob: 0.06 },
  ],
  replied: [
    { next: "meeting_booked", prob: 0.4 },
    { next: "disqualified", prob: 0.05 },
  ],
  meeting_booked: [],
  disqualified: [],
};

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startTimeEngine() {
  const { clock } = useStore.getState();
  if (intervalHandle) return; // already running
  useStore.getState().setClock({ running: true });
  intervalHandle = setInterval(tick, BASE_TICK_MS);
  useStore.getState().log({
    layer: 3,
    type: "user_action",
    summary: `Simulation started at ${clock.speed}x speed`,
  });
}

export function stopTimeEngine() {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
  useStore.getState().setClock({ running: false });
  useStore.getState().log({
    layer: 3,
    type: "user_action",
    summary: "Simulation paused",
  });
}

export function setSpeed(speed: 1 | 5 | 10) {
  useStore.getState().setClock({ speed });
}

function tick() {
  const store = useStore.getState();
  const { clock, campaigns } = store;
  if (!clock.running) return;

  // Advance simulated time
  store.tickSimulatedTime(SIM_MS_PER_TICK_BASE * clock.speed);
  const nowIso = useStore.getState().clock.simulatedTime;

  for (const c of campaigns) {
    processLead(c, nowIso, clock.speed);
  }
}

function processLead(
  c: CampaignLead,
  nowIso: string,
  speed: 1 | 5 | 10,
): void {
  const opts = STAGE_TRANSITIONS[c.stage];
  if (!opts || opts.length === 0) return;

  // Scale probability per tick by speed multiplier
  for (const opt of opts) {
    const p = Math.min(0.95, opt.prob * (speed === 1 ? 1 : speed * 0.4));
    if (Math.random() < p) {
      advanceLead(c.companyId, opt.next, nowIso);
      return; // one transition per lead per tick max
    }
  }

  // Even without a stage transition, occasionally add a follow-up touchpoint
  // while in email_sequence_active to simulate ongoing nurture.
  if (c.stage === "email_sequence_active" && Math.random() < 0.18 * speed) {
    addTouchpoint(c.companyId, c.activeStep, "follow_up", nowIso, "email");
  }
}

function advanceLead(
  companyId: string,
  next: CampaignStage,
  nowIso: string,
): void {
  const store = useStore.getState();
  const c = store.campaigns.find((x) => x.companyId === companyId);
  const company = store.companies.find((x) => x.id === companyId);
  if (!c || !company) return;

  store.updateCampaignStage(companyId, next, nowIso);
  store.log({
    layer: 3,
    type: "stage_change",
    summary: `${company.name}: ${c.stage} → ${next}`,
    companyId,
    at: nowIso,
  });

  // Emit touchpoint matching the new stage
  switch (next) {
    case "connection_sent":
      addTouchpoint(companyId, c.activeStep, "connection_request", nowIso, "linkedin");
      break;
    case "email_sequence_active":
      addTouchpoint(companyId, c.activeStep, "email", nowIso, "email");
      break;
    case "replied": {
      addTouchpoint(companyId, c.activeStep, "reply_received", nowIso, "linkedin");
      // Advance step to next stakeholder for the next round.
      const nextStep = Math.min(4, c.activeStep + 1) as 1 | 2 | 3 | 4;
      if (nextStep !== c.activeStep) {
        store.setActiveStep(companyId, nextStep);
        // If not yet at meeting, restart the engagement chain at the next step
        // unless we're transitioning to meeting_booked (handled by transitions).
      }
      // CRM: engaged
      syncDealFromStage(companyId, "engaged", nowIso);
      break;
    }
    case "meeting_booked":
      syncDealFromStage(companyId, "meeting_scheduled", nowIso);
      toast.success(`Meeting booked with ${company.name}`, {
        description: "Sales team has been notified.",
        duration: 4000,
      });
      store.log({
        layer: 3,
        type: "notification",
        summary: `Meeting booked with ${company.name} — sales team notified`,
        companyId,
        at: nowIso,
      });
      break;
    case "disqualified":
      syncDealFromStage(companyId, "closed_lost", nowIso);
      break;
    default:
      break;
  }

  recordDealActivity(companyId, {
    id: uid("act"),
    at: nowIso,
    type: "stage_change",
    summary: `Campaign stage → ${next}`,
  });
}

function addTouchpoint(
  companyId: string,
  step: 1 | 2 | 3 | 4,
  type: Touchpoint["type"],
  nowIso: string,
  channel: Touchpoint["channel"],
): void {
  // Fire-and-forget through the outreach gateway. Gateway routes
  // LinkedIn actions through /api/linkedin/send when a real provider
  // is configured; otherwise it falls back to the local simulation.
  const input = { companyId, step, type, nowIso };
  if (channel === "linkedin") {
    void emitLinkedInAction(input);
  } else {
    void emitEmailAction(input);
  }
}
