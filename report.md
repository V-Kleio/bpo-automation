# BPO Automation — Project Progress Report

**Date:** 2026-05-22  
**Project:** AI-Powered Outreach Automation for Indonesian BPO Market  
**Client Context:** Wiz.AI (voice AI for contact centers)

---

## What This Project Is

A fully interactive demo prototype showing how AI can automate end-to-end outreach to the 20 highest-value Indonesian BPO companies. The system simulates a 4-layer workflow: sourcing leads → AI-scoring them → running personalized outreach sequences → syncing outcomes to a CRM pipeline.

Built entirely as a Next.js 15 frontend with no backend — all data is seeded, all AI responses are mocked, and all simulation runs locally in the browser.

---

## What Each Layer Does

### Layer 1 — Lead Database (`/leads`)

Displays all mock-up BPO companies data in a sortable, searchable table. Each row shows company name, industry tags, headcount, HQ city, priority tier, intent signals, and analysis status. Users select rows and trigger AI analysis. Clicking a row opens a detail drawer with stakeholder names and a link to the full analysis.



### Layer 2 — AI Intelligence Workbench (`/intelligence`)

Three-column layout. Left rail lists all analyzed companies sorted by priority score. Center shows the selected company's full analysis:

- Priority score (0–100), calculated deterministically from tier + intent signals + headcount
- 5-dimension qualification checklist: Industry Fit, Operational Pain, Digital Maturity, Buying Signals, Budget Potential
- Partnership analysis: Strategic Alignment, AI Readiness, Growth Potential, Localization Fit
- 4-step generated messages — one LinkedIn DM and one email per stakeholder role (Champion, Economic Buyer, Technical Gatekeeper, CEO) with Copy/Edit/Approve controls
- "Push to Campaign" button to promote a qualified lead to Layer 3

Right sidebar is a streamed Ask AI chat — token-by-token output, context-aware to selected companies, with suggested prompts.

### Layer 3 — Campaign & Outreach Manager (`/campaigns`)

Kanban board with 6 columns: Queued → Connection Sent → Email Sequence Active → Replied → Meeting Booked → Disqualified.

Each company card shows the active outreach step (e.g., "Step 2/4: Engaging COO"), stakeholder avatars, and last touchpoint. Clicking a card opens a thread drawer with a 4-step timeline and message previews per stakeholder.

Simulation controls let the user start/stop time and choose speed (1x, 5x, 10x). At 10x, a full campaign cycle (queued → meeting booked) typically completes in 30–60 seconds. Stage transitions are probabilistic:

- Queued → Connection Sent: 35% per tick
- Connection Sent → Email Active: 30% / Disqualified: 4%
- Email Active → Replied: 22% / Disqualified: 6%
- Replied → Meeting Booked: 40% / Disqualified: 5%

On `replied`, the active stakeholder step advances (1 → 2 → 3 → 4) to engage the next role in the sequence.

### Layer 4 — CRM Pipeline (`/crm`)

HubSpot-style deal board with 6 stages: New → Engaged → Qualified Opportunity → Meeting Scheduled → Closed Won → Closed Lost. Deals are auto-created and updated as campaigns progress. Each deal card shows company name, tier, estimated deal amount, and last activity timestamp.

Deal amounts are estimated by tier:
- Priority: $80,000–$150,000
- Warm: $25,000–$55,000
- Nurture: $8,000–$20,000

AEs are assigned round-robin from 4 sales reps. A "Notify Sales" panel shows all meeting-booked deals with AE name and notification timestamp. An activity drawer shows the full touchpoint history for each deal.

### Logs & Analytics (`/logs`)

Top section: funnel chart (leads by stage), channel performance bar chart, layer activity pie chart — all dynamically updated from the event log.

Bottom section: scrollable event log showing all 4-layer events (AI calls, channel sends, replies, CRM syncs, stage changes) with timestamp, layer badge, company name, and summary. Filterable by type and layer.

### Overview Dashboard (`/`)

Hero strip showing live funnel counts across all 4 layers. Quick action buttons. Last 10 log events. Entry point for demos.

---

## Technology Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15, App Router |
| Language | TypeScript 5 (strict mode) |
| UI | React 19, Tailwind CSS 4, shadcn/ui |
| State | Zustand 5 with localStorage persistence |
| Charts | Recharts 3 |
| Icons | Lucide React |
| Animation | Motion (Framer Motion) |
| Notifications | Sonner |

No backend, no external API calls. Everything runs in-browser.

---

## Data

**20 real Indonesian BPO companies** sourced from the original PDF brief.  
**11 named stakeholders** with real names, titles, and LinkedIn-style profiles from the same PDF.  
**Additional stakeholders** are synthesized per company to fill the 4-step role sequence (Champion, Economic Buyer, Technical Gatekeeper, CEO) where named contacts were not provided.

All seed data is deterministic — reloading or resetting the demo always returns the same baseline state.

---

## What Works End-to-End

1. Land on Overview → see empty funnel
2. Go to Lead Database → select companies → click "Run AI Analysis"
3. Rows animate through `analyzing` → `qualified` with scores populated
4. Go to Intelligence → select a company → view qualification breakdown, generated messages, Ask AI chat
5. Click "Push to Campaign" → company appears in Kanban `Queued` column
6. Toggle simulation clock at 10x → cards advance through stages autonomously with toast notifications
7. Go to CRM → deal pipeline populated automatically, AE assigned, activities logged
8. Go to Logs → full event history, charts updated
9. Reset Demo → all state returns to seed baseline

---

## Codebase Size

- **63 TypeScript/TSX files** across `app/`, `components/`, and `lib/`
- **~5,600 lines of code** total
- **42 React components**, organized by feature layer
- **4 mock service modules** (ai-engine, outreach-engine, time-engine, crm-sync)

---

## What Is Not Implemented (By Design)

This is a prototype demo, not a production system. The following are intentionally absent:

- Real API calls (no Anthropic, no LinkedIn, no HubSpot API)
- Authentication or multi-user state
- Actual email/LinkedIn sending
- Backend persistence (uses localStorage only)
- Mobile-optimized layout beyond basic sidebar hiding

These omissions are appropriate for the demo's purpose: showing the workflow and value proposition without infrastructure overhead.

---

## Summary

The project is complete and demo-ready. All 4 layers are implemented, all screens are functional, and the end-to-end simulation loop works. The codebase is clean with no stubs, no TODO markers, and no broken flows. It accurately represents a realistic AI-assisted outreach system targeting the Indonesian BPO market with Wiz.AI's value proposition.
