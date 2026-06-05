# Weekly Change Summary — 2026-05-29 → 2026-06-05

BPO Outreach Automation (Next.js 16 / React 19 / TypeScript). This week
focused on making the live layers reliable — Layer 1 data acquisition,
Layer 2 Claude analysis, and Layer 3 LinkedIn engagement — plus a new
browser-based settings editor.

---

## Layer 1 — Lead Acquisition

- **Dropped mock seed data.** The lead store now starts empty; no demo
  rows. (`b6a13f9`)
- **HubSpot sync switched to the contacts endpoint**, grouping contacts
  into companies. (`b6a13f9`)
- **LeadTable gained multi-select filters and pagination** for working
  through larger imported lists. (`63d2f55`)

## Layer 2 — Claude AI Intelligence

- **Switched to Claude Max OAuth** via the Anthropic SDK, embedded the Wiz
  qualification criteria in the system prompt, and enabled web search
  (behind a feature flag). Removed the mock fallback entirely. (`c2e48ee`)
- **Per-lead errors now surface** as toasts instead of being silently
  swallowed; `web_search` is gated behind a server flag. (`aacdfbf`)
- **Robust to partial tool payloads** — `submit_lead_analysis` responses
  missing fields no longer crash analysis; the no-search prompt variant
  was aligned with the no-tool call path. (`aac7ddd`)
- **AI-generated LinkedIn messages are now capped at LinkedIn's limit.**
  The analyze schema and prompts instruct the model to keep LinkedIn DMs
  ≤200 characters (free-account connection-note limit, ~180 target) so
  generated notes are no longer truncated downstream.

## Layer 3 — LinkedIn Engagement (the main reliability push)

LinkedIn is the only live channel; email is intentionally unsupported.
Most of the week's effort went into the Playwright automation adapter.

- **Email retired as a channel** — StepActions hides/disables email
  touchpoints; LinkedIn-only. (`a1e63f3`)
- **Paced send queue with one-click bulk enqueue.** An HMR-safe global
  queue processes invites with a daily cap and randomized inter-send
  delay; the campaign UI polls a status panel showing pending/sending/
  sent/failed counts and the last failures. (`b35f772`)
- **Authwall fix:** the headed-login context and the headless send context
  now share an identical browser fingerprint, so LinkedIn stops flagging
  the saved session as a different device. (`4f5fc15`)
- **Connect-button detection rewritten** as a DOM-walking text scan
  (replacing fragile scoped selectors), scoped to the profile's own action
  area and ranked by spatial proximity to the profile heading — robust to
  LinkedIn's A/B markup changes. (`eb1c4b0`, `e9dd8f0`)
- **Note truncation** on connection requests so notes fit the limit and
  read cleanly (word-boundary trim, shared `truncateNote` helper). (`d0e7b39`)

### No-note fallback for non-Premium accounts (this week)

Free LinkedIn accounts run out of custom-note quota and get a Premium
upsell instead of the note textbox. The adapter now:

- Detects the upsell, and **falls back to connecting without a note**
  rather than failing the request.
- Once the quota is known-exhausted in a session, **skips the "Add a note"
  step entirely** on subsequent sends (avoids a fragile double-Connect),
  going straight to "Send without a note".
- When the note attempt polluted the dialog, **reloads the profile for a
  clean slate** before re-clicking Connect — this avoids LinkedIn's
  "invitation not sent, please try again" rejection caused by rapid
  re-invites.

### Send verification — never claim a false success (this week)

Clicking Send and the dialog closing is **not** proof an invite was sent —
LinkedIn dismisses the dialog and *then* shows an error toast while leaving
the profile on "Connect". The adapter now verifies the durable post-state:

- Detects LinkedIn's "invitation not sent / please try again" error toast
  and reports failure with the real reason.
- Confirms the profile's top card flipped to **"Pending"** (polled in
  place, then via one profile reload) before returning success.

This earlier landed as dialog-dismissal verification (`da00fe9`) and was
strengthened this week to the Pending + error-toast checks. Genuine
rejections now show up accurately in the queue's failure log instead of
being logged as sent.

## New — Settings page (browser-based config)

- **`/settings`** lets you edit configuration (API keys, models, LinkedIn
  provider toggles, pacing) from the browser instead of hand-editing
  `.env.local`.
- Saves **write `.env.local`** (atomic tmp+rename, preserving comments and
  unmanaged keys), **mutate `process.env` in-process** for immediate
  effect, and **reset cached SDK singletons** so changed credentials apply
  without a restart.
- **Secrets stay server-only**: the page shows `isSet` + a masked preview
  (`••••1234`), never the cleartext value. Blank = keep; explicit Clear =
  unset.
- Validates daily cap, min ≤ max delay, non-empty models, and URL fields,
  with inline field errors. Shows the effective LinkedIn provider after
  each save.

## Housekeeping

- Removed demo/prototype labels from UI copy. (`787e4ee`)
- `.env.local.example` expanded; build docs moved out of the repo root.

---

### Notable commits

| Commit | Summary |
|--------|---------|
| `d0e7b39` | LinkedIn note truncation |
| `0160391` | misc automation fixes |
| `b35f772` | paced LinkedIn send queue + bulk enqueue |
| `a1e63f3` | LinkedIn-only; email unsupported |
| `787e4ee` | drop demo/prototype labels |
| `aac7ddd` | partial-payload handling + prompt alignment |
| `aacdfbf` | per-lead Claude errors; gate web_search |
| `c2e48ee` | Claude Max OAuth + Wiz criteria + web search |
| `63d2f55` | LeadTable filters + pagination |
| `b6a13f9` | drop mock seed data; HubSpot contacts sync |
| `da00fe9` | verify invitation dialog dismisses |

> The no-note fallback, Pending/error-toast verification, AI message
> character cap, and the Settings page are the newest work and are noted
> above; see the latest commits on `main` for exact diffs.
