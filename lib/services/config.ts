// Server-only config reader. NEVER import this from client code.
// The "use client" components access these flags via /api/config which
// returns only sanitized booleans + enum values.

import "server-only";
import fs from "fs";
import path from "path";

function trim(v: string | undefined): string {
  return (v ?? "").trim();
}

export function getServerConfig() {
  const anthropicKey = trim(process.env.ANTHROPIC_API_KEY);
  const anthropicAuthToken = trim(process.env.ANTHROPIC_AUTH_TOKEN);
  const anthropicBaseUrl = trim(process.env.ANTHROPIC_BASE_URL);
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
      modelAnalyze:
        trim(process.env.CLAUDE_MODEL_ANALYZE) || "claude-opus-4-7",
      modelChat:
        trim(process.env.CLAUDE_MODEL_CHAT) || "claude-haiku-4-5",
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

export interface PublicConfig {
  anthropic: { configured: boolean };
  hubspot: { configured: boolean };
  linkedin: {
    provider: LinkedInProvider;
    authenticated: boolean;
    dailyCap: number;
  };
}

export function getPublicFlags(): PublicConfig {
  const cfg = getServerConfig();
  const { provider } = selectLinkedInProvider(cfg);
  return {
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
  };
}
