export type Tier = "priority" | "warm" | "nurture";

export type LeadStatus =
  | "pending_analysis"
  | "analyzing"
  | "qualified"
  | "disqualified";

export type StakeholderRole =
  | "champion"
  | "economic_buyer"
  | "technical_gatekeeper"
  | "ceo";

export type StakeholderPriority = "high" | "medium" | "low";

export type CampaignStage =
  | "queued"
  | "connection_sent"
  | "email_sequence_active"
  | "replied"
  | "meeting_booked"
  | "disqualified";

export type DealStage =
  | "new"
  | "engaged"
  | "qualified_opportunity"
  | "meeting_scheduled"
  | "closed_won"
  | "closed_lost";

export type Channel = "linkedin" | "email";

export type TouchpointType =
  | "connection_request"
  | "dm"
  | "email"
  | "follow_up"
  | "reply_received";

export type TouchpointStatus =
  | "pending"
  | "delivered"
  | "opened"
  | "replied"
  | "ignored";

export type IntentSignalType =
  | "hiring"
  | "digital_transformation"
  | "funding"
  | "expansion"
  | "tech_adoption";

export interface IntentSignal {
  type: IntentSignalType;
  label: string;
  strength: "weak" | "moderate" | "strong";
}

export interface Company {
  id: string;
  name: string;
  industry: string[];
  size: string;
  headcount: number;
  hq: string;
  tier: Tier;
  whyTarget: string;
  intentSignals: IntentSignal[];
  website?: string;
  status: LeadStatus;
  analysis?: AIAnalysis;
  pushedToCampaignAt?: string;
}

export interface Stakeholder {
  id: string;
  companyId: string;
  name: string;
  title: string;
  role: StakeholderRole;
  priority: StakeholderPriority;
  whyTarget: string;
  linkedinUrl?: string;
  email?: string;
}

// Each Wiz criterion is scored 0-10 (integer) per the PDF rubric.
export interface QualificationDimension {
  score: number; // 0-10
  reasoning: string;
}

// Keys mirror lib/services/claude/wiz-criteria.ts → WIZ_CRITERION_KEYS.
// Keep these in lockstep with that module.
export interface WizQualification {
  callVolume: QualificationDimension;
  costPressure: QualificationDimension;
  useCaseFit: QualificationDimension;
  budgetCapacity: QualificationDimension;
  digitalMaturity: QualificationDimension;
  regulatoryFit: QualificationDimension;
  languageNeed: QualificationDimension;
  channelPartnerLeverage: QualificationDimension;
  competitiveWhitespace: QualificationDimension;
}

export interface AIAnalysis {
  // 0-100 — average of the 9 criterion scores × 10. Stored at 0-100 so the
  // existing UI bits that render priorityScore as a 2-3 digit badge keep
  // working without conditional formatting.
  priorityScore: number;
  qualification: WizQualification;
  partnership: {
    strategicAlignment: string;
    aiReadiness: string;
    growthPotential: string;
    localizationFit: string;
  };
  // Optional one-line summary of what the AI found while web-searching the
  // company, so the UI can show "What the AI learned" without re-fetching.
  webResearchSummary?: string;
  generatedMessages: GeneratedMessage[];
  analyzedAt: string;
}

export interface GeneratedMessage {
  id: string;
  stakeholderId: string;
  channel: Channel;
  subject?: string;
  body: string;
  step: 1 | 2 | 3 | 4;
  approved?: boolean;
}

export interface Touchpoint {
  id: string;
  stakeholderId: string;
  channel: Channel;
  type: TouchpointType;
  sentAt: string;
  status: TouchpointStatus;
  step: 1 | 2 | 3 | 4;
  messagePreview: string;
}

export interface CampaignLead {
  companyId: string;
  stage: CampaignStage;
  activeStep: 1 | 2 | 3 | 4;
  touchpoints: Touchpoint[];
  enteredStageAt: string;
  createdAt: string;
}

export interface DealActivity {
  id: string;
  at: string;
  type: "stage_change" | "touchpoint" | "reply" | "note" | "sync";
  summary: string;
}

export interface Deal {
  id: string;
  companyId: string;
  stage: DealStage;
  amount?: number;
  assignedAE?: string;
  activities: DealActivity[];
  createdAt: string;
  notifiedAt?: string;
}

export interface LogEvent {
  id: string;
  at: string;
  layer: 1 | 2 | 3 | 4;
  type:
    | "ai_call"
    | "channel_send"
    | "reply"
    | "crm_sync"
    | "notification"
    | "stage_change"
    | "user_action";
  summary: string;
  companyId?: string;
  meta?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
  contextCompanyIds?: string[];
  streaming?: boolean;
}

export interface ClockState {
  running: boolean;
  speed: 1 | 5 | 10;
  simulatedTime: string;
}

export const STEP_TO_ROLE: Record<1 | 2 | 3 | 4, StakeholderRole> = {
  1: "champion",
  2: "economic_buyer",
  3: "technical_gatekeeper",
  4: "ceo",
};

export const ROLE_TO_STEP: Record<StakeholderRole, 1 | 2 | 3 | 4> = {
  champion: 1,
  economic_buyer: 2,
  technical_gatekeeper: 3,
  ceo: 4,
};

export const ROLE_LABEL: Record<StakeholderRole, string> = {
  champion: "Operational Champion",
  economic_buyer: "Economic Buyer",
  technical_gatekeeper: "Technical Gatekeeper",
  ceo: "CEO / Final Sign-off",
};

export const STAGE_LABEL: Record<CampaignStage, string> = {
  queued: "Queued",
  connection_sent: "Connection Sent",
  email_sequence_active: "Email Sequence Active",
  replied: "Replied",
  meeting_booked: "Meeting Booked",
  disqualified: "Disqualified",
};

export const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  new: "New",
  engaged: "Engaged",
  qualified_opportunity: "Qualified Opportunity",
  meeting_scheduled: "Meeting Scheduled",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};
