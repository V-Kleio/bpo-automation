// Server-only config reader. NEVER import this from client code.
// The "use client" components access these flags via /api/config which
// returns only sanitized booleans + enum values.

import "server-only";
import fs from "fs";
import path from "path";
import {
  AI_PRESETS,
  presetBaseURL,
  isLocalhostURL,
  type AIProviderId,
} from "@/lib/services/ai/presets";

function trim(v: string | undefined): string {
  return (v ?? "").trim();
}

export function getServerConfig() {
  const anthropicKey = trim(process.env.ANTHROPIC_API_KEY);
  const anthropicAuthToken = trim(process.env.ANTHROPIC_AUTH_TOKEN);
  const anthropicBaseUrl = trim(process.env.ANTHROPIC_BASE_URL);
  // Server-side web_search is a first-party-API feature. The Claude Max
  // OAuth gateway currently rejects it with a confusing schema error
  // ("tools.0.web_search_20250305.name: Input should be 'web_search'").
  // Default-on for ANTHROPIC_API_KEY users, default-off for OAuth users,
  // override-able via ANTHROPIC_ENABLE_WEB_SEARCH=1 or =0.
  const webSearchOverride = trim(
    process.env.ANTHROPIC_ENABLE_WEB_SEARCH,
  ).toLowerCase();
  const webSearchEnabled =
    webSearchOverride === "1" || webSearchOverride === "true"
      ? true
      : webSearchOverride === "0" || webSearchOverride === "false"
        ? false
        : anthropicKey.length > 0;
  // Generic OpenAI-compatible provider (Groq / OpenRouter / Gemini / Ollama /
  // Custom). A preset implies its base URL; "custom" reads AI_OPENAI_BASE_URL.
  const aiProvider = trim(process.env.AI_PROVIDER) || "auto";
  const openaiKey = trim(process.env.AI_OPENAI_API_KEY);
  const openaiBaseURL =
    presetBaseURL(aiProvider) ?? trim(process.env.AI_OPENAI_BASE_URL);
  const openaiHasKey =
    openaiKey.length > 0 ||
    (openaiBaseURL.length > 0 && isLocalhostURL(openaiBaseURL));
  const openaiMaxTokens = Number(
    trim(process.env.AI_OPENAI_MAX_TOKENS) || "4096",
  );

  const hubspotToken = trim(process.env.HUBSPOT_PRIVATE_APP_TOKEN);
  const unipileKey = trim(process.env.UNIPILE_API_KEY);
  const unipileAccount = trim(process.env.UNIPILE_ACCOUNT_ID);
  const mcpUrl = trim(process.env.LINKEDIN_MCP_URL);
  const enablePlaywright = trim(process.env.ENABLE_PLAYWRIGHT_LINKEDIN) === "1";
  const sessionPath = trim(
    process.env.LINKEDIN_SESSION_PATH || ".data/linkedin/session.json",
  );
  const dailyCap = Number(trim(process.env.LINKEDIN_DAILY_CAP) || "25");
  const minDelayMs = Number(
    trim(process.env.LINKEDIN_MIN_DELAY_MS) || "180000",
  );
  const maxDelayMs = Number(
    trim(process.env.LINKEDIN_MAX_DELAY_MS) || "600000",
  );

  const dbHost = trim(process.env.DB_HOST);
  const dbUser = trim(process.env.DB_USER);
  const dbName = trim(process.env.DB_NAME);
  const dbConfigured = dbHost.length > 0 && dbUser.length > 0 && dbName.length > 0;

  return {
    anthropic: {
      // hasKey now means "has any usable auth": either a first-party API key
      // OR an OAuth bearer (Claude Max via ANTHROPIC_AUTH_TOKEN + a custom
      // ANTHROPIC_BASE_URL pointing at the gateway). Exactly one of apiKey
      // or authToken should be set; if both are present the SDK accepts both
      // but the gateway will reject mixed auth.
      hasKey: anthropicKey.length > 0 || anthropicAuthToken.length > 0,
      apiKey: anthropicKey,
      authToken: anthropicAuthToken,
      baseURL: anthropicBaseUrl,
      webSearchEnabled,
      modelAnalyze:
        trim(process.env.CLAUDE_MODEL_ANALYZE) || "claude-opus-4-7",
      modelChat:
        trim(process.env.CLAUDE_MODEL_CHAT) || "claude-haiku-4-5",
    },
    ai: {
      provider: aiProvider,
      openai: {
        baseURL: openaiBaseURL,
        apiKey: openaiKey,
        hasKey: openaiHasKey,
        modelAnalyze: trim(process.env.AI_OPENAI_MODEL_ANALYZE),
        modelChat: trim(process.env.AI_OPENAI_MODEL_CHAT),
        structuredMode:
          trim(process.env.AI_OPENAI_STRUCTURED_MODE) || "auto",
        maxTokens:
          Number.isFinite(openaiMaxTokens) && openaiMaxTokens > 0
            ? openaiMaxTokens
            : 4096,
      },
    },
    hubspot: {
      hasKey: hubspotToken.length > 0,
      token: hubspotToken,
    },
    linkedin: {
      unipile: {
        hasKey: unipileKey.length > 0,
        apiKey: unipileKey,
        accountId: unipileAccount,
      },
      mcp: {
        url: mcpUrl,
      },
      playwright: {
        enabled: enablePlaywright,
        sessionPath: path.resolve(process.cwd(), sessionPath),
        hasSession:
          enablePlaywright &&
          fs.existsSync(path.resolve(process.cwd(), sessionPath)),
        // Default headless. Set LINKEDIN_PLAYWRIGHT_HEADLESS=false (or 0)
        // to run sends in a visible browser — much friendlier to LinkedIn's
        // anti-automation heuristics at the cost of seeing a window pop up.
        headless:
          trim(process.env.LINKEDIN_PLAYWRIGHT_HEADLESS) !== "false" &&
          trim(process.env.LINKEDIN_PLAYWRIGHT_HEADLESS) !== "0",
      },
      dailyCap,
      minDelayMs,
      maxDelayMs,
    },
    db: {
      configured: dbConfigured,
      type: trim(process.env.DB_TYPE) || "mysql",
      host: dbHost,
      port: Number(trim(process.env.DB_PORT) || "3306"),
      name: dbName,
      user: dbUser,
      // Password is read on-demand in the DB client — not stored in this
      // config object to keep it out of server logs.
    },
  };
}

export type LinkedInProvider = "unipile" | "mcp" | "playwright" | "mock";

export function selectLinkedInProvider(
  cfg: ReturnType<typeof getServerConfig>,
): { provider: LinkedInProvider; reason: string } {
  if (cfg.linkedin.unipile.hasKey) {
    return { provider: "unipile", reason: "UNIPILE_API_KEY is set" };
  }
  if (cfg.linkedin.mcp.url) {
    return { provider: "mcp", reason: "LINKEDIN_MCP_URL is set" };
  }
  if (cfg.linkedin.playwright.enabled) {
    return {
      provider: "playwright",
      reason: cfg.linkedin.playwright.hasSession
        ? "Playwright session present"
        : "Playwright enabled, awaiting login",
    };
  }
  return { provider: "mock", reason: "No LinkedIn provider configured" };
}

// Which reasoning backend is actually live. `provider` is the resolved,
// user-facing id (never "auto"); `kind` is the adapter family the AI router
// instantiates. mirrors selectLinkedInProvider's shape.
export interface AISelection {
  provider: Exclude<AIProviderId, "auto"> | "none";
  kind: "anthropic" | "openai-compat" | "none";
  reason: string;
}

export function selectAIProvider(
  cfg: ReturnType<typeof getServerConfig>,
): AISelection {
  const p = cfg.ai.provider;
  const openaiReady = cfg.ai.openai.hasKey && cfg.ai.openai.baseURL.length > 0;

  // Explicit Anthropic.
  if (p === "anthropic") {
    return cfg.anthropic.hasKey
      ? { provider: "anthropic", kind: "anthropic", reason: "AI_PROVIDER=anthropic" }
      : {
          provider: "none",
          kind: "none",
          reason: "AI_PROVIDER=anthropic but no Anthropic credentials",
        };
  }

  // Explicit OpenAI-compatible provider (a preset or custom).
  if (p !== "auto") {
    const label = AI_PRESETS[p]?.label ?? "Custom OpenAI-compatible";
    return openaiReady
      ? {
          provider: p as Exclude<AIProviderId, "auto">,
          kind: "openai-compat",
          reason: `${label} · ${cfg.ai.openai.baseURL}`,
        }
      : {
          provider: "none",
          kind: "none",
          reason: `AI_PROVIDER=${p} but the base URL or API key is incomplete`,
        };
  }

  // auto: prefer existing Anthropic credentials (preserves prior behavior),
  // then fall back to any configured OpenAI-compatible endpoint.
  if (cfg.anthropic.hasKey) {
    return {
      provider: "anthropic",
      kind: "anthropic",
      reason: "Anthropic credentials present",
    };
  }
  if (openaiReady) {
    return {
      provider: "custom",
      kind: "openai-compat",
      reason: `OpenAI-compatible endpoint · ${cfg.ai.openai.baseURL}`,
    };
  }
  return { provider: "none", kind: "none", reason: "No AI provider configured" };
}

export interface PublicConfig {
  ai: { configured: boolean; provider: string; kind: string };
  anthropic: { configured: boolean };
  hubspot: { configured: boolean };
  linkedin: {
    provider: LinkedInProvider;
    authenticated: boolean;
    dailyCap: number;
  };
  db: { configured: boolean };
}

export function getPublicFlags(): PublicConfig {
  const cfg = getServerConfig();
  const { provider } = selectLinkedInProvider(cfg);
  const ai = selectAIProvider(cfg);
  return {
    ai: { configured: ai.kind !== "none", provider: ai.provider, kind: ai.kind },
    anthropic: { configured: cfg.anthropic.hasKey },
    hubspot: { configured: cfg.hubspot.hasKey },
    linkedin: {
      provider,
      authenticated:
        provider === "unipile" ||
        provider === "mcp" ||
        (provider === "playwright" && cfg.linkedin.playwright.hasSession),
      dailyCap: cfg.linkedin.dailyCap,
    },
    db: { configured: cfg.db.configured },
  };
}
