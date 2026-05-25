"use client";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/utils";
import {
  ROLE_TO_STEP,
  STEP_TO_ROLE,
  type Channel,
  type Stakeholder,
  type Touchpoint,
  type TouchpointType,
} from "@/lib/types";

// Wrapper around the store's pushToCampaign with logging.
export function launchCampaign(companyId: string): void {
  const store = useStore.getState();
  const company = store.companies.find((c) => c.id === companyId);
  if (!company) return;
  store.pushToCampaign(companyId);
  store.log({
    layer: 3,
    type: "stage_change",
    summary: `Campaign launched for ${company.name} — entering Queued`,
    companyId,
  });
}

interface CreateTouchpointInput {
  companyId: string;
  step: 1 | 2 | 3 | 4;
  type: TouchpointType;
  channel: Channel;
  nowIso: string;
}

// Picks a stakeholder for the given step and synthesizes a touchpoint.
export function createTouchpoint({
  companyId,
  step,
  type,
  channel,
  nowIso,
}: CreateTouchpointInput): Touchpoint | null {
  const store = useStore.getState();
  const role = STEP_TO_ROLE[step];
  const candidate = store.stakeholders.find(
    (s) => s.companyId === companyId && s.role === role,
  );
  if (!candidate) return null;

  const messagePreview = previewFor(type, candidate, channel);

  return {
    id: uid("tp"),
    stakeholderId: candidate.id,
    channel,
    type,
    sentAt: nowIso,
    status: type === "reply_received" ? "replied" : "delivered",
    step,
    messagePreview,
  };
}

function previewFor(
  type: TouchpointType,
  st: Stakeholder,
  channel: Channel,
): string {
  const first = st.name.split(" ")[0];
  switch (type) {
    case "connection_request":
      return `Sent LinkedIn connection request to ${first} (${st.title}).`;
    case "dm":
      return `LinkedIn DM to ${first}: "Hi ${first} — saw your work running operations. Worth a quick chat?"`;
    case "email":
      return `Email to ${first}: subject opens with "${st.title.includes("Operations") ? "Cutting agent workload by 70%" : "ROI model for your team"}".`;
    case "follow_up":
      return `Follow-up via ${channel === "linkedin" ? "LinkedIn DM" : "email"} to ${first}.`;
    case "reply_received":
      return `${first} replied: "Interesting — could we set up a 20-min call next week?"`;
    default:
      return "";
  }
}

export const STEP_TO_ROLE_EXPORT = STEP_TO_ROLE;
export const ROLE_TO_STEP_EXPORT = ROLE_TO_STEP;
