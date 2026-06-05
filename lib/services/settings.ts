// Server-only settings service backing the /settings page.
//
// The app's configuration lives in .env.local. This module lets the UI
// edit it: applySettings() (1) line-edits .env.local so the change is
// durable, (2) mutates process.env in-process so getServerConfig() —
// which re-reads process.env on every call — sees the new values
// immediately (also what makes saves live under `next start`, where env
// files aren't watched), and (3) resets the module-cached SDK singletons
// so changed credentials actually take effect.
//
// SECURITY (hard rule): secrets never leave the server. readCurrentSettings
// returns isSet + a mask for secret fields — the cleartext value is omitted.

import "server-only";
import fs from "fs";
import path from "path";
import {
  getServerConfig,
  selectLinkedInProvider,
  type LinkedInProvider,
} from "@/lib/services/config";
import { resetAnthropic } from "@/lib/services/claude/client";
import { resetHubSpotClient } from "@/lib/services/hubspot/client";
import { resetAdapterCache } from "@/lib/services/linkedin/selector";

const ENV_PATH = path.resolve(process.cwd(), ".env.local");

export type SettingGroup =
  | "claude"
  | "hubspot"
  | "linkedin_provider"
  | "linkedin_pacing";

export type SettingType = "string" | "secret" | "boolean" | "number" | "enum";

export type EnvKey =
  | "ANTHROPIC_API_KEY"
  | "ANTHROPIC_AUTH_TOKEN"
  | "ANTHROPIC_BASE_URL"
  | "ANTHROPIC_ENABLE_WEB_SEARCH"
  | "CLAUDE_MODEL_ANALYZE"
  | "CLAUDE_MODEL_CHAT"
  | "HUBSPOT_PRIVATE_APP_TOKEN"
  | "UNIPILE_API_KEY"
  | "UNIPILE_ACCOUNT_ID"
  | "LINKEDIN_MCP_URL"
  | "ENABLE_PLAYWRIGHT_LINKEDIN"
  | "LINKEDIN_PLAYWRIGHT_HEADLESS"
  | "LINKEDIN_DAILY_CAP"
  | "LINKEDIN_MIN_DELAY_MS"
  | "LINKEDIN_MAX_DELAY_MS";

export interface SettingField {
  key: EnvKey;
  label: string;
  group: SettingGroup;
  type: SettingType;
  enumValues?: readonly string[];
  placeholder?: string;
  help?: string;
}

// The allowlist: only keys listed here can be read or written via the
// settings API. LINKEDIN_SESSION_PATH is intentionally not editable from
// the web (path-typed, niche; default is fine).
export const SETTING_FIELDS: readonly SettingField[] = [
  // ── Claude / AI ────────────────────────────────────────────────────
  {
    key: "ANTHROPIC_API_KEY",
    label: "Anthropic API key",
    group: "claude",
    type: "secret",
    help: "First-party API key (sk-ant-…). Leave blank if using a Claude Max OAuth token.",
  },
  {
    key: "ANTHROPIC_AUTH_TOKEN",
    label: "Anthropic OAuth token",
    group: "claude",
    type: "secret",
    help: "Claude Max OAuth bearer token; requires a gateway base URL below.",
  },
  {
    key: "ANTHROPIC_BASE_URL",
    label: "Anthropic base URL",
    group: "claude",
    type: "string",
    placeholder: "https://…",
    help: "Custom SDK base URL (e.g. the Claude Max gateway). Leave blank for the default API.",
  },
  {
    key: "ANTHROPIC_ENABLE_WEB_SEARCH",
    label: "Web search for lead analysis",
    group: "claude",
    type: "enum",
    enumValues: ["auto", "on", "off"],
    help: "auto = on when using an API key, off when using OAuth (the gateway rejects server-side tools).",
  },
  {
    key: "CLAUDE_MODEL_ANALYZE",
    label: "Analysis model",
    group: "claude",
    type: "string",
    placeholder: "claude-opus-4-7",
  },
  {
    key: "CLAUDE_MODEL_CHAT",
    label: "Chat model",
    group: "claude",
    type: "string",
    placeholder: "claude-haiku-4-5",
  },
  // ── HubSpot ────────────────────────────────────────────────────────
  {
    key: "HUBSPOT_PRIVATE_APP_TOKEN",
    label: "HubSpot private app token",
    group: "hubspot",
    type: "secret",
    help: "pat-… token. Enables the HubSpot contact sync on the Leads page.",
  },
  // ── LinkedIn provider ──────────────────────────────────────────────
  {
    key: "UNIPILE_API_KEY",
    label: "Unipile API key",
    group: "linkedin_provider",
    type: "secret",
    help: "Highest-precedence provider; needs the account ID below.",
  },
  {
    key: "UNIPILE_ACCOUNT_ID",
    label: "Unipile account ID",
    group: "linkedin_provider",
    type: "string",
  },
  {
    key: "LINKEDIN_MCP_URL",
    label: "LinkedIn MCP URL",
    group: "linkedin_provider",
    type: "string",
    placeholder: "https://…",
  },
  {
    key: "ENABLE_PLAYWRIGHT_LINKEDIN",
    label: "Enable Playwright adapter",
    group: "linkedin_provider",
    type: "boolean",
    help: "Free, local-only. Requires one headed login via the Connect LinkedIn button.",
  },
  {
    key: "LINKEDIN_PLAYWRIGHT_HEADLESS",
    label: "Run sends headless",
    group: "linkedin_provider",
    type: "boolean",
    help: "Off = sends open a visible browser window (friendlier to LinkedIn's anti-automation).",
  },
  // ── LinkedIn pacing ────────────────────────────────────────────────
  {
    key: "LINKEDIN_DAILY_CAP",
    label: "Daily action cap",
    group: "linkedin_pacing",
    type: "number",
    placeholder: "25",
  },
  {
    key: "LINKEDIN_MIN_DELAY_MS",
    label: "Min delay between sends (ms)",
    group: "linkedin_pacing",
    type: "number",
    placeholder: "180000",
  },
  {
    key: "LINKEDIN_MAX_DELAY_MS",
    label: "Max delay between sends (ms)",
    group: "linkedin_pacing",
    type: "number",
    placeholder: "600000",
  },
] as const;

const SECRET_KEYS = new Set<EnvKey>([
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "HUBSPOT_PRIVATE_APP_TOKEN",
  "UNIPILE_API_KEY",
]);

const FIELD_BY_KEY = new Map(SETTING_FIELDS.map((f) => [f.key, f]));

export function isEditableKey(key: string): key is EnvKey {
  return FIELD_BY_KEY.has(key as EnvKey);
}

export interface SanitizedField {
  key: EnvKey;
  label: string;
  group: SettingGroup;
  type: SettingType;
  enumValues?: readonly string[];
  placeholder?: string;
  help?: string;
  isSet: boolean;
  /** Secrets only: "••••" + last 4 chars (or "set"). Cleartext is never sent. */
  mask?: string;
  /** Non-secrets only: current effective value. */
  value?: string;
}

export interface SettingsView {
  fields: SanitizedField[];
  linkedin: { provider: LinkedInProvider; reason: string };
  anthropic: {
    configured: boolean;
    webSearchEffective: boolean;
    mixedAuth: boolean;
  };
}

function rawEnv(key: EnvKey): string {
  return (process.env[key] ?? "").trim();
}

function maskSecret(value: string): string {
  if (value.length >= 8) return `••••${value.slice(-4)}`;
  return "set";
}

// The current value as the UI should display it. For enum/boolean fields
// we normalize the raw env string into the canonical UI value.
function displayValue(field: SettingField): string {
  const raw = rawEnv(field.key);
  switch (field.key) {
    case "ANTHROPIC_ENABLE_WEB_SEARCH": {
      const v = raw.toLowerCase();
      if (v === "1" || v === "true") return "on";
      if (v === "0" || v === "false") return "off";
      return "auto";
    }
    case "ENABLE_PLAYWRIGHT_LINKEDIN":
      return raw === "1" ? "1" : "0";
    case "LINKEDIN_PLAYWRIGHT_HEADLESS":
      // config.ts: headless unless explicitly "false"/"0".
      return raw === "false" || raw === "0" ? "0" : "1";
    default:
      return raw;
  }
}

export function readCurrentSettings(): SettingsView {
  const cfg = getServerConfig();
  const { provider, reason } = selectLinkedInProvider(cfg);
  const fields: SanitizedField[] = SETTING_FIELDS.map((f) => {
    const raw = rawEnv(f.key);
    const base: SanitizedField = {
      key: f.key,
      label: f.label,
      group: f.group,
      type: f.type,
      enumValues: f.enumValues,
      placeholder: f.placeholder,
      help: f.help,
      isSet: raw.length > 0,
    };
    if (SECRET_KEYS.has(f.key)) {
      if (raw.length > 0) base.mask = maskSecret(raw);
    } else {
      base.value = displayValue(f);
    }
    return base;
  });
  return {
    fields,
    linkedin: { provider, reason },
    anthropic: {
      configured: cfg.anthropic.hasKey,
      webSearchEffective: cfg.anthropic.webSearchEnabled,
      mixedAuth:
        cfg.anthropic.apiKey.length > 0 && cfg.anthropic.authToken.length > 0,
    },
  };
}

export class SettingsValidationError extends Error {
  readonly fieldErrors: Partial<Record<EnvKey, string>>;
  constructor(fieldErrors: Partial<Record<EnvKey, string>>) {
    super("Settings validation failed");
    this.name = "SettingsValidationError";
    this.fieldErrors = fieldErrors;
  }
}

// Sentinel for "delete this key's line from .env.local".
const DELETE = Symbol("delete");
type Resolved = string | typeof DELETE;

// Translate a UI value into what gets written to .env.local for that key.
// Returning DELETE removes the line (falling back to the config.ts default).
function serializeForEnv(field: SettingField, uiValue: string): Resolved {
  const v = uiValue.trim();
  switch (field.key) {
    case "ANTHROPIC_ENABLE_WEB_SEARCH":
      if (v === "on") return "1";
      if (v === "off") return "0";
      return DELETE; // auto = unset
    case "ENABLE_PLAYWRIGHT_LINKEDIN":
      return v === "1" ? "1" : DELETE; // off = unset (config checks === "1")
    case "LINKEDIN_PLAYWRIGHT_HEADLESS":
      return v === "0" ? "false" : DELETE; // headless is the unset default
    default:
      return v.length === 0 ? DELETE : v;
  }
}

function isIntegerString(v: string): boolean {
  return /^\d+$/.test(v);
}

function isValidUrl(v: string): boolean {
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

// Validate against the *resolved* state (current env merged with updates)
// so e.g. changing only MIN still checks against the effective MAX.
function validate(resolved: Map<EnvKey, Resolved>): void {
  const errors: Partial<Record<EnvKey, string>> = {};
  const effective = (key: EnvKey, fallback: string): string => {
    if (resolved.has(key)) {
      const r = resolved.get(key)!;
      return r === DELETE ? fallback : r;
    }
    return rawEnv(key) || fallback;
  };

  const cap = effective("LINKEDIN_DAILY_CAP", "25");
  if (!isIntegerString(cap) || Number(cap) < 1) {
    errors.LINKEDIN_DAILY_CAP = "Must be a whole number ≥ 1.";
  }
  const min = effective("LINKEDIN_MIN_DELAY_MS", "180000");
  const max = effective("LINKEDIN_MAX_DELAY_MS", "600000");
  if (!isIntegerString(min)) {
    errors.LINKEDIN_MIN_DELAY_MS = "Must be a whole number of milliseconds.";
  }
  if (!isIntegerString(max)) {
    errors.LINKEDIN_MAX_DELAY_MS = "Must be a whole number of milliseconds.";
  }
  if (
    isIntegerString(min) &&
    isIntegerString(max) &&
    Number(min) > Number(max)
  ) {
    errors.LINKEDIN_MIN_DELAY_MS = "Min delay must be ≤ max delay.";
  }

  for (const key of ["CLAUDE_MODEL_ANALYZE", "CLAUDE_MODEL_CHAT"] as const) {
    if (resolved.has(key)) {
      const r = resolved.get(key)!;
      // DELETE falls back to the config.ts default model — that's fine.
      if (r !== DELETE && r.trim().length === 0) {
        errors[key] = "Model name cannot be blank.";
      }
    }
  }

  for (const key of ["ANTHROPIC_BASE_URL", "LINKEDIN_MCP_URL"] as const) {
    if (resolved.has(key)) {
      const r = resolved.get(key)!;
      if (r !== DELETE && !isValidUrl(r)) {
        errors[key] = "Must be a valid URL (or blank to unset).";
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new SettingsValidationError(errors);
  }
}

// Quote a value for an env file when it contains characters dotenv would
// otherwise mis-parse. Plain values are written bare, matching the
// hand-written style of the existing .env.local.
function quoteEnvValue(value: string): string {
  if (/[\s#"'=]/.test(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

const ENV_LINE_RE = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=/;

// Line-based .env.local rewrite: managed keys are replaced/removed in
// place; comments, blank lines, and unmanaged keys are preserved verbatim;
// newly set keys are appended. Atomic via tmp + rename.
function writeEnvFile(resolved: Map<EnvKey, Resolved>): void {
  const existing = fs.existsSync(ENV_PATH)
    ? fs.readFileSync(ENV_PATH, "utf8")
    : "";
  const lines = existing.length > 0 ? existing.split(/\r?\n/) : [];
  const seen = new Set<EnvKey>();
  const out: string[] = [];

  for (const line of lines) {
    const m = line.match(ENV_LINE_RE);
    const key = m?.[1];
    if (key && isEditableKey(key) && resolved.has(key)) {
      seen.add(key);
      const r = resolved.get(key)!;
      if (r === DELETE) continue; // drop the line
      out.push(`${key}=${quoteEnvValue(r)}`);
    } else {
      out.push(line);
    }
  }

  // Append keys that weren't in the file yet (registry order).
  for (const field of SETTING_FIELDS) {
    if (!resolved.has(field.key) || seen.has(field.key)) continue;
    const r = resolved.get(field.key)!;
    if (r === DELETE) continue;
    out.push(`${field.key}=${quoteEnvValue(r)}`);
  }

  const tmpPath = `${ENV_PATH}.tmp`;
  fs.writeFileSync(tmpPath, out.join("\n"));
  fs.renameSync(tmpPath, ENV_PATH);
}

export interface ApplyResult {
  ok: true;
  view: SettingsView;
}

// updates semantics per key:
//   secret + ""        → keep existing (the UI sends "" for untouched masks)
//   null               → explicit clear (delete the line / unset)
//   any other string   → set (enum/boolean values are UI-canonical and get
//                        serialized to the env conventions per key)
export function applySettings(
  updates: Partial<Record<EnvKey, string | null>>,
): ApplyResult {
  const resolved = new Map<EnvKey, Resolved>();

  for (const [key, value] of Object.entries(updates) as Array<
    [EnvKey, string | null]
  >) {
    const field = FIELD_BY_KEY.get(key);
    if (!field) continue; // route already rejects; defense in depth
    if (value === null) {
      resolved.set(key, DELETE);
      continue;
    }
    if (SECRET_KEYS.has(key) && value.trim().length === 0) {
      continue; // blank secret = keep existing
    }
    resolved.set(key, serializeForEnv(field, value));
  }

  validate(resolved);

  if (resolved.size > 0) {
    writeEnvFile(resolved);

    // Mutate process.env so getServerConfig() (per-call reader) sees the
    // change immediately — required under `next start`, harmless in dev
    // where the env watcher re-reads the same file values.
    for (const [key, r] of resolved) {
      if (r === DELETE) delete process.env[key];
      else process.env[key] = r;
    }

    // Rebuild module-cached singletons whose credentials may have changed.
    const changed = new Set(resolved.keys());
    if (
      changed.has("ANTHROPIC_API_KEY") ||
      changed.has("ANTHROPIC_AUTH_TOKEN") ||
      changed.has("ANTHROPIC_BASE_URL")
    ) {
      resetAnthropic();
    }
    if (changed.has("HUBSPOT_PRIVATE_APP_TOKEN")) {
      resetHubSpotClient();
    }
    if (
      changed.has("UNIPILE_API_KEY") ||
      changed.has("UNIPILE_ACCOUNT_ID") ||
      changed.has("LINKEDIN_MCP_URL") ||
      changed.has("ENABLE_PLAYWRIGHT_LINKEDIN")
    ) {
      resetAdapterCache();
    }
  }

  return { ok: true, view: readCurrentSettings() };
}
