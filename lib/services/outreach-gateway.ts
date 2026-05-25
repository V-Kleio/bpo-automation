"use client";
// Gateway in front of touchpoint emission. The time-engine calls
// emitLinkedInAction / emitEmailAction instead of writing touchpoints
// directly. When the LinkedIn provider is "mock" or unreachable, the
// touchpoint is synthesized locally — preserving the existing simulation
// behavior. Otherwise the LinkedIn action goes through /api/linkedin/send.
// Email always uses the mock path (per spec: email stays simulated).

import { useStore } from "@/lib/store";
import { uid } from "@/lib/utils";
import { createTouchpoint } from "@/lib/mock/outreach-engine";
import { recordDealActivity } from "@/lib/mock/crm-sync";
import { getClientConfig } from "./public-config-client";
import type {
  Channel,
  Stakeholder,
  Touchpoint,
  TouchpointType,
} from "@/lib/types";
import { STEP_TO_ROLE } from "@/lib/types";

export interface EmitInput {
  companyId: string;
  step: 1 | 2 | 3 | 4;
  type: TouchpointType;
  nowIso: string;
}

interface EmitWithStakeholder extends EmitInput {
  channel: Channel;
}

async function isLinkedInLive(): Promise<boolean> {
  try {
    const cfg = await getClientConfig();
    return (
      cfg.linkedin.authenticated && cfg.linkedin.provider !== "mock"
    );
  } catch {
    return false;
  }
}

function findStakeholder(
  companyId: string,
  step: 1 | 2 | 3 | 4,
): Stakeholder | undefined {
  const role = STEP_TO_ROLE[step];
  return useStore
    .getState()
    .stakeholders.find((s) => s.companyId === companyId && s.role === role);
}

function appendMockTouchpoint(input: EmitWithStakeholder): void {
  const tp = createTouchpoint({
    companyId: input.companyId,
    step: input.step,
    type: input.type,
    channel: input.channel,
    nowIso: input.nowIso,
  });
  if (!tp) return;
  const store = useStore.getState();
  store.appendTouchpoint(input.companyId, tp);
  store.log({
    layer: 3,
    type: input.type === "reply_received" ? "reply" : "channel_send",
    summary: tp.messagePreview,
    companyId: input.companyId,
    at: input.nowIso,
  });
  recordDealActivity(input.companyId, {
    id: uid("act"),
    at: input.nowIso,
    type: input.type === "reply_received" ? "reply" : "touchpoint",
    summary: tp.messagePreview,
  });
}

export async function emitLinkedInAction(input: EmitInput): Promise<void> {
  const ev: EmitWithStakeholder = { ...input, channel: "linkedin" };

  if (input.type === "reply_received") {
    // Replies are simulated regardless of provider — we don't poll LinkedIn
    // for replies in this scaffold.
    appendMockTouchpoint(ev);
    return;
  }

  if (!(await isLinkedInLive())) {
    appendMockTouchpoint(ev);
    return;
  }

  const stakeholder = findStakeholder(input.companyId, input.step);
  if (!stakeholder?.linkedinUrl) {
    appendMockTouchpoint(ev);
    return;
  }

  const kind: "connect" | "dm" =
    input.type === "connection_request" ? "connect" : "dm";

  try {
    const response = await fetch("/api/linkedin/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind,
        profileUrl: stakeholder.linkedinUrl,
        firstName: stakeholder.name.split(" ")[0] ?? stakeholder.name,
        note:
          kind === "connect"
            ? `Hi ${stakeholder.name.split(" ")[0]} — open to a brief chat about workload reduction at your team?`
            : undefined,
        body: kind === "dm" ? buildOutreachBody(stakeholder) : undefined,
      }),
    });

    if (!response.ok) {
      appendMockTouchpoint(ev);
      return;
    }
    const data = (await response.json()) as {
      success: boolean;
      provider: string;
      externalId?: string;
      error?: string;
    };

    const store = useStore.getState();
    const tp: Touchpoint = {
      id: data.externalId ?? uid("tp"),
      stakeholderId: stakeholder.id,
      channel: "linkedin",
      type: input.type,
      sentAt: input.nowIso,
      status: data.success ? "delivered" : "pending",
      step: input.step,
      messagePreview: `[${data.provider}] LinkedIn ${kind === "connect" ? "connection request" : "DM"} to ${stakeholder.name.split(" ")[0]} (${stakeholder.title}).`,
    };
    store.appendTouchpoint(input.companyId, tp);
    store.log({
      layer: 3,
      type: "channel_send",
      summary: tp.messagePreview,
      companyId: input.companyId,
      at: input.nowIso,
      meta: {
        provider: data.provider,
        success: data.success,
        externalId: data.externalId,
      },
    });
    recordDealActivity(input.companyId, {
      id: uid("act"),
      at: input.nowIso,
      type: "touchpoint",
      summary: tp.messagePreview,
    });
  } catch {
    appendMockTouchpoint(ev);
  }
}

export async function emitEmailAction(input: EmitInput): Promise<void> {
  // Email is always simulated in this scaffold.
  appendMockTouchpoint({ ...input, channel: "email" });
}

function buildOutreachBody(stakeholder: Stakeholder): string {
  const first = stakeholder.name.split(" ")[0] ?? stakeholder.name;
  return `Hi ${first} — saw your work running ${stakeholder.title}. Wiz.AI helps Indonesian BPOs cut agent workload by ~70% with Bahasa-native voice AI. Worth 15 mins next week?`;
}
