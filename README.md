# BPO Outreach Automation

AI-assisted outreach prototype targeting Indonesian BPO companies. Built as a
Next.js 15 app with a 4-layer architecture (Lead Database → AI Intelligence →
Campaign Manager → CRM Tracking) and an integration surface that lets each
layer run either against real services or against a built-in mock.

With zero env vars the app runs the original demo: 20 seeded BPO companies,
deterministic mock scoring, regex-templated chat, probability-driven stage
transitions. Add API keys to `.env.local` to swap any layer over to real
services without touching the UI.

## Running locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Wiring up real integrations

Copy `.env.local.example` to `.env.local` and fill in only the keys you have.
Each integration is independent — the others stay in mock mode until you
configure them.

### Layer 1 — Lead acquisition

Two real input paths land alongside the seeded data:

- **CSV / XLSX upload** — always on. Click **Import** on `/leads`, drop in a
  file with at least `companyName` plus either `linkedinUrls` (separated by
  `;`) or `email`. Optional columns: `contactName`, `contactTitle`,
  `contactRole`, `tier`, `industry`, `hq`, `headcount`, `website`,
  `whyTarget`. A working sample lives at
  [`/sample/sample-linkedin-targets.csv`](public/sample/sample-linkedin-targets.csv)
  — link is also available in the import dialog.
- **HubSpot pull** — set `HUBSPOT_PRIVATE_APP_TOKEN` (scope:
  `crm.objects.companies.read`). The **Sync HubSpot** button appears in the
  leads toolbar. Leave the env blank to keep the button hidden.

### Layer 2 — Real Claude AI

```
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL_ANALYZE=claude-opus-4-7   # heavy structured reasoning
CLAUDE_MODEL_CHAT=claude-haiku-4-5     # fast streaming chat
```

Effects:
- **Run AI Analysis** on `/leads` calls `/api/analyze-leads`, which runs up
  to 3 parallel Claude calls with forced tool-use to produce a structured
  `AIAnalysis` JSON per company. Results stream back as NDJSON so rows flip
  `analyzing → qualified` progressively.
- **Ask Claude** sidebar on `/intelligence` streams text deltas from
  `/api/ask-claude`. Both routes use ephemeral prompt caching on the system
  prompt so the rubric / chat persona is reused across calls in a session.

If the Anthropic call fails for an individual company, the router falls back
to the local mock for that lead and toasts a warning — other leads in the
batch continue normally.

### Layer 3 — Real LinkedIn outreach

Provider precedence (set at most one):

1. **Unipile** — `UNIPILE_API_KEY` + `UNIPILE_ACCOUNT_ID`. Routed through
   `lib/services/linkedin/adapter-unipile.ts`. Paid 3rd party.
2. **MCP** — `LINKEDIN_MCP_URL`. Stub adapter; wire your MCP client into
   `lib/services/linkedin/adapter-mcp.ts`.
3. **Playwright** — `ENABLE_PLAYWRIGHT_LINKEDIN=1`. Free, runs locally.
   Requires a one-time `npx playwright install chromium`. Click **Connect
   LinkedIn** on `/campaigns`; a real browser window opens, you log in, the
   session is saved to `.data/linkedin/session.json` and reused for
   subsequent sends.
4. **Mock** — the fallback. The Kanban / drawer show "Simulated" badges and
   touchpoints are generated locally as before.

#### Anti-block controls (apply to any real provider)

```
LINKEDIN_DAILY_CAP=25            # hard ceiling per UTC day
LINKEDIN_MIN_DELAY_MS=180000     # 3 min minimum between actions
LINKEDIN_MAX_DELAY_MS=600000     # 10 min maximum
```

Daily usage is persisted to `.data/linkedin/usage.json` and reset at midnight
UTC. Hitting the cap returns a 429 from `/api/linkedin/send` and the
gateway falls back to a simulated touchpoint for the remainder of the day.

#### Testing LinkedIn end-to-end without seed data

The sample CSV ships with two real-looking LinkedIn URLs paired with fake
company names so you can drive the whole pipeline:

1. Upload `public/sample/sample-linkedin-targets.csv` via **Import** on
   `/leads`.
2. Select the imported rows → **Run AI Analysis** (will use the real Claude
   API if `ANTHROPIC_API_KEY` is set).
3. **Push to Campaign** from `/intelligence`.
4. On `/campaigns`, **Connect LinkedIn** if Playwright is the active
   provider, then start the simulation. LinkedIn sends flow through your
   chosen adapter; email stays simulated.

## Architecture notes

- All real integrations live behind `LinkedInAdapter` / `ai-router` /
  `hubspot/fetch-companies` interfaces. Each has a mock implementation that
  remains the active path until env vars are set.
- Secrets never reach the browser. The `/api/config` route returns sanitized
  booleans + the active LinkedIn provider name; components branch on those.
- The Zustand store and seed data are untouched — real and mock paths
  emit the same `Company` / `Stakeholder` / `Touchpoint` shapes so the rest
  of the UI doesn't care which path was used.
- LinkedIn replies and stage advancement remain simulated — the daily cap
  is intentionally small so we don't try to scrape an inbox.

## Tech stack

Next.js 15 (App Router), React 19, TypeScript strict, Tailwind 4,
shadcn-style UI primitives, Zustand 5 (localStorage persistence), Sonner,
Recharts, Lucide icons. Anthropic SDK, HubSpot SDK, Playwright,
papaparse, xlsx.
