# BPO Outreach Automation — Layer 2 & Layer 3 Prototype (Refined)

## Context

The PDF spec defines a 5-layer system for AI-assisted outreach to Indonesian BPO companies. This prototype focuses on **Layer 2 (Centralized AI Intelligence)** and **Layer 3 (Automated Engagement)**, with a thin mock of **Layer 1** (seeded database) and **Layer 4** (HubSpot CRM view) to demonstrate the end-to-end story.

Goals:
- A presentable, click-through demo that tells the full workflow narrative.
- All data mocked — no live APIs, no real Claude calls, no real LinkedIn/HubSpot integration.
- Behavior feels realistic: simulated AI latency, streamed-ish outputs, a time-progression engine that advances leads through the pipeline autonomously.

Design decisions:
- **Layer 2 UI:** Hybrid — structured analysis panels with an "Ask AI" chat sidebar.
- **Layer 3 model:** One Kanban card per company; opening the card reveals the multi-stakeholder thread.
- **Layer 4:** Included as a mock HubSpot deal-pipeline screen.
- **Time simulation:** Auto-run with 1x / 5x / 10x speed control.
- **Seed data:** Real company and contact names from the PDF.
- **Persistence:** `localStorage` with a "Reset Demo" button.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **State:** Zustand with `persist` middleware (localStorage)
- **Icons:** Lucide React
- **Drag-and-drop (Kanban):** `@dnd-kit/core` + `@dnd-kit/sortable`
- **Charts (analytics):** Recharts
- **Animations:** Framer Motion (for streaming text + stage transitions)
- **Mock async:** plain `setTimeout` / `setInterval`; no external mock-API library needed

---

## Project Structure

```
bpo-automation/
├── app/
│   ├── layout.tsx                 # sidebar nav shell
│   ├── page.tsx                   # Overview dashboard (/)
│   ├── leads/page.tsx             # Lead Database (Layer 1 mock)
│   ├── intelligence/page.tsx      # Layer 2 — AI workbench + chat
│   ├── campaigns/page.tsx         # Layer 3 — Kanban + stakeholder threads
│   ├── crm/page.tsx               # Layer 4 — mock HubSpot deal pipeline
│   └── logs/page.tsx              # Logs & Analytics
├── components/
│   ├── shell/                     # Sidebar, TopBar, ResetDemoButton, SpeedControl
│   ├── leads/                     # LeadTable, LeadDetailDrawer, TierBadge, IntentSignalChip
│   ├── intelligence/              # AnalysisPanel, ScoreCard, QualificationChecklist,
│   │                              # PartnershipPanel, GeneratedMessageCard, AskAIChat
│   ├── campaigns/                 # KanbanBoard, CompanyCard, StakeholderThreadDrawer,
│   │                              # OutreachStepTimeline, SimulateClockToggle
│   ├── crm/                       # DealPipeline, DealCard, ActivityFeed, NotifySalesPanel
│   └── logs/                      # EventLogFeed, FunnelChart, ChannelPerformanceChart
├── lib/
│   ├── store/                     # Zustand slices (see "State Architecture")
│   ├── mock/                      # Seed data, mock-service layer
│   │   ├── seed-companies.ts      # 20 real BPO companies from PDF
│   │   ├── seed-contacts.ts       # 11+ real LinkedIn contacts from PDF
│   │   ├── ai-engine.ts           # simulated scoring, qualification, message generation
│   │   ├── outreach-engine.ts     # simulated LinkedIn/email send
│   │   ├── time-engine.ts         # auto-progression interval loop
│   │   └── crm-sync.ts            # mock HubSpot sync events
│   └── types.ts                   # domain types
└── ...
```

---

## Domain Model (types)

```ts
type Tier = 'priority' | 'warm' | 'nurture';
type LeadStatus = 'pending_analysis' | 'analyzing' | 'qualified' | 'disqualified';
type StakeholderRole = 'champion' | 'economic_buyer' | 'technical_gatekeeper' | 'ceo';
type CampaignStage = 'queued' | 'connection_sent' | 'email_sequence_active'
                   | 'replied' | 'meeting_booked' | 'disqualified';
type DealStage = 'new' | 'engaged' | 'qualified_opportunity' | 'meeting_scheduled' | 'closed_won' | 'closed_lost';

interface Company {
  id: string;
  name: string;            // e.g. "PT Infomedia Nusantara"
  industry: string[];      // e.g. ["Banking", "Retail", "CRM"]
  size: string;            // "8,232 employees"
  hq: string;              // "Jakarta"
  tier: Tier;
  whyTarget: string;       // from PDF
  intentSignals: IntentSignal[];  // hiring, digital-transformation, funding
  website?: string;
  status: LeadStatus;
  analysis?: AIAnalysis;   // populated by Layer 2
}

interface Stakeholder {
  id: string;
  companyId: string;
  name: string;            // e.g. "Andri Wibawanto"
  title: string;
  role: StakeholderRole;
  priority: 'high' | 'medium' | 'low';
  whyTarget: string;
  linkedinUrl?: string;
  email?: string;
}

interface AIAnalysis {
  priorityScore: number;       // 0-100
  qualification: {             // spec's 5 dimensions
    industryFit: { score: number; reasoning: string };
    operationalPain: { score: number; reasoning: string };
    digitalMaturity: { score: number; reasoning: string };
    buyingSignals: { score: number; reasoning: string };
    budgetPotential: { score: number; reasoning: string };
  };
  partnership: {               // spec's partnership analysis
    strategicAlignment: string;
    aiReadiness: string;
    growthPotential: string;
    localizationFit: string;
  };
  generatedMessages: Array<{
    stakeholderId: string;
    channel: 'linkedin' | 'email';
    subject?: string;
    body: string;
    step: 1 | 2 | 3 | 4;        // 4-step outreach strategy
  }>;
  analyzedAt: string;
}

interface CampaignLead {
  companyId: string;
  stage: CampaignStage;
  activeStep: 1 | 2 | 3 | 4;   // which stakeholder tier is currently being engaged
  touchpoints: Touchpoint[];   // ordered timeline across stakeholders + channels
  enteredStageAt: string;
}

interface Touchpoint {
  id: string;
  stakeholderId: string;
  channel: 'linkedin' | 'email';
  type: 'connection_request' | 'dm' | 'email' | 'follow_up' | 'reply_received';
  sentAt: string;
  status: 'pending' | 'delivered' | 'opened' | 'replied' | 'ignored';
  messagePreview: string;
}

interface Deal { /* mock HubSpot */
  id: string;
  companyId: string;
  stage: DealStage;
  amount?: number;
  activities: Array<{ at: string; type: string; summary: string }>;
}

interface LogEvent {
  id: string;
  at: string;
  layer: 1 | 2 | 3 | 4;
  type: 'ai_call' | 'channel_send' | 'reply' | 'crm_sync' | 'notification' | 'stage_change';
  summary: string;
  meta?: Record<string, unknown>;
}
```

Seed data lives in `lib/mock/seed-companies.ts` and `lib/mock/seed-contacts.ts`, populated verbatim from the PDF (20 companies, ~11 named contacts mapped to their companies + role; supplement remaining companies with synthesized stakeholders following the same role pattern).

---

## State Architecture (Zustand)

Single root store with named slices, persisted to localStorage:

- `companiesSlice` — CRUD on companies + their `analysis` field
- `stakeholdersSlice` — read-mostly, seeded from PDF
- `campaignsSlice` — `CampaignLead` records, stage transitions, touchpoints
- `dealsSlice` — mock HubSpot deals (auto-created when a lead moves to `replied`)
- `logsSlice` — append-only event log (cap to last 500 in-memory)
- `clockSlice` — `{ running: bool, speed: 1|5|10, simulatedTime: ISO }`

Selectors for derived metrics (funnel counts, channel-conversion %) live alongside the slices.

---

## Mock Service Layer

### `lib/mock/ai-engine.ts`
- `analyzeLeads(companyIds): Promise<void>` — for each company, set status to `analyzing`, wait 1.5–3s (stagger), compute deterministic-but-realistic scores from company fields (priority tier weighted heavily, intent signals add boosts), generate per-stakeholder messages from templates referencing the company's `whyTarget`. Emit `LogEvent`s as it goes.
- `streamAskAI(prompt, contextLeadIds): AsyncIterable<string>` — yields tokens via a generator with 30–60ms delay so the chat sidebar feels live. Responses are template-driven, pulling from the analyses of the context leads.

### `lib/mock/outreach-engine.ts`
- `launchCampaign(companyIds): void` — moves companies from Layer 2 (`qualified`) into Layer 3 `queued`, creates initial `CampaignLead` records with `activeStep=1` (Champion).

### `lib/mock/time-engine.ts`
- `start(speed)` / `stop()` — runs a `setInterval` (300ms base tick × speed multiplier). Each tick:
  - For each `CampaignLead` in a non-terminal stage, roll a weighted die against transition probabilities (e.g. `queued → connection_sent`: 25% per tick at 1x).
  - On `replied`: advance `activeStep` (1→2→3→4) and queue the next stakeholder's outreach.
  - At `meeting_booked` or `disqualified`: terminal; emit notification log + `crm-sync.ts` deal-stage update.
  - Append touchpoint entries and `LogEvent`s on every transition.

### `lib/mock/crm-sync.ts`
- Subscribes to campaign stage changes via Zustand. Emits matching `Deal` updates and "Synced to HubSpot" log events.

All probabilities are tunable constants at the top of each file so a demo can be tweaked to land "Meeting Booked" outcomes within a 30–60s window.

---

## Screens

### 1. Overview Dashboard (`/`)
- Hero strip showing the 4-layer workflow as horizontal cards with live counts (Acquired / Analyzed / In Campaign / Booked Meetings).
- Funnel chart (Recharts).
- "Recent Activity" feed (last 10 `LogEvent`s).
- CTAs: "Open Lead Database", "Launch AI Analysis", "View Campaigns".

### 2. Lead Database (`/leads`) — Layer 1 mock
- `LeadTable`: sortable, filterable (tier, industry, status). Columns: checkbox, Company, Industry tags, Size, HQ, Tier badge, Intent-signal chips, Status.
- Top toolbar: "Run AI Analysis (N selected)" → calls `ai-engine.analyzeLeads()`, animates rows into `analyzing` then `qualified/disqualified`.
- Row click → `LeadDetailDrawer`: company details, stakeholder list, "View Full Analysis" link to `/intelligence?companyId=X`.

### 3. Centralized AI Intelligence (`/intelligence`) — **Layer 2**
- Left column (60%): structured analysis for the currently selected company:
  - Header: company name, tier, priority score gauge (0–100)
  - `QualificationChecklist`: 5 dimensions with sub-scores and inline reasoning
  - `PartnershipPanel`: strategic alignment, AI readiness, growth, localization
  - `GeneratedMessageCard` × stakeholder × channel — tabbed by the 4 outreach steps, showing LinkedIn DM and Email side-by-side; copy / edit / "Approve" buttons
  - "Push to Campaign" button → moves company into Layer 3 `queued`
- Right column (40%): `AskAIChat` sidebar — context-aware (currently selected company / multi-select from leads page). Streamed token output. Suggested prompts ("Why is this lead a fit?", "Draft a follow-up for Zaki Wahab").
- Left rail: list of analyzed companies for quick switching.

### 4. Campaign & Outreach Manager (`/campaigns`) — **Layer 3**
- Kanban board with 6 columns: Queued, Connection Sent, Email Sequence Active, Replied, Meeting Booked, Disqualified.
- Each `CompanyCard`: company name, tier badge, active-step indicator ("Step 2/4: Engaging COO"), stakeholder avatars, last-touchpoint timestamp.
- Card click → `StakeholderThreadDrawer`:
  - `OutreachStepTimeline`: 4 vertical steps with stakeholder name, status (pending / sent / replied / skipped), and touchpoint list below each step. Animated check-marks as steps complete.
  - Inline message previews per touchpoint.
- Top toolbar: `SimulateClockToggle` with speed selector (1x / 5x / 10x) and a simulated-time display.
- Toast notifications on terminal transitions ("Meeting booked with Wahyu Wibisono — sales team notified").

### 5. CRM Tracking (`/crm`) — **Layer 4 mock HubSpot**
- `DealPipeline`: 6 deal stages, each showing deal cards with company, amount estimate, last activity.
- Click → `ActivityFeed` for that deal (auto-populated from campaign touchpoints + manual notes field).
- `NotifySalesPanel`: list of meeting-booked deals with "Assigned AE" + "Notification sent at..." stamps.
- Read-only view; updates flow in from `crm-sync.ts`.

### 6. Logs & Analytics (`/logs`)
- Top: funnel + channel-performance + conversion-rate charts.
- Bottom: real-time `EventLogFeed` with type filters and layer filters. Each row: timestamp, layer badge, type icon, summary.

### Shell (all screens)
- Left sidebar nav with the 5 routes + workflow indicator showing where each route sits in the layered architecture.
- Top bar: "Reset Demo" button, global clock state, notification bell (latest 5 events).

---

## Implementation Phases (suggested build order)

1. **Scaffold + shell** — Next.js, Tailwind, shadcn/ui setup, sidebar layout, route stubs, "Reset Demo" wiring.
2. **Domain types + seed data** — `lib/types.ts`, `seed-companies.ts`, `seed-contacts.ts`, Zustand store with persist.
3. **Lead Database screen** — table, filters, drawer.
4. **Mock AI engine + Layer 2 screen** — `ai-engine.ts`, analysis panels, generated-message cards, Ask AI chat with streamed mock responses.
5. **Push-to-campaign + Layer 3 Kanban** — `outreach-engine.ts`, Kanban board, stakeholder thread drawer.
6. **Time engine + simulation controls** — `time-engine.ts`, clock toggle, probabilistic transitions, toast notifications.
7. **CRM sync + Layer 4 screen** — `crm-sync.ts`, deal pipeline, activity feed.
8. **Logs & analytics + Overview dashboard** — funnel/channel charts, event-log feed, layered-overview cards.
9. **Polish** — animations (Framer Motion on stage transitions + streaming text), empty states, error states for "no leads selected", responsive check on common desktop widths.

---

## Critical Files To Create

- `lib/types.ts` — single source of truth for domain types
- `lib/mock/seed-companies.ts`, `lib/mock/seed-contacts.ts` — verbatim from PDF
- `lib/mock/ai-engine.ts`, `lib/mock/outreach-engine.ts`, `lib/mock/time-engine.ts`, `lib/mock/crm-sync.ts`
- `lib/store/index.ts` + slice files
- Page files under `app/` and matching component folders under `components/`

---

## Verification (end-to-end demo checklist)

Run the dev server (`npm run dev`) and walk this exact path:

1. **Overview (`/`)** — confirm funnel shows seed counts (20 acquired, 0 analyzed, 0 in campaign, 0 booked) and "Reset Demo" restores state.
2. **Leads (`/leads`)** — verify 20 real companies render with correct tier badges (Priority/Warm/Nurture). Filter by "Priority" → expect 7 rows. Select 3 priority companies → "Run AI Analysis" → rows animate through `analyzing` → `qualified`.
3. **Intelligence (`/intelligence`)** — open one analyzed company. Verify: priority score renders, all 5 qualification dimensions populated with reasoning, partnership panel populated, 4-step generated messages exist for each stakeholder × channel. Send a prompt in the Ask AI chat → confirm streamed token output. Click "Push to Campaign" → toast confirms move to Layer 3.
4. **Campaigns (`/campaigns`)** — pushed company appears in `Queued`. Toggle simulation at 10x speed. Within ~30s: lead progresses through stages, touchpoints accumulate on the stakeholder thread drawer, `activeStep` advances 1→4 on replies, terminal "Meeting Booked" triggers a toast.
5. **CRM (`/crm`)** — deal for that company exists and has progressed in lockstep; activity feed shows campaign touchpoints; meeting-booked deals appear in `NotifySalesPanel`.
6. **Logs (`/logs`)** — confirm event-log feed contains entries for each layer (analysis, channel sends, replies, CRM syncs, notifications). Funnel chart reflects current pipeline.
7. **Refresh the page mid-flow** — confirm state persists. Click "Reset Demo" → confirm seed restored.

This walkthrough proves the layered architecture end-to-end without any live API. Each layer's mock service can later be swapped for a real implementation behind the same interface.
