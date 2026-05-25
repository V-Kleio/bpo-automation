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
      hasKey: anthropicKey.length > 0,
      apiKey: anthropicKey,
      modelAnalyze:
        trim(process.env.CLAUDE_MODEL_ANALYZE) || "claude-sonnet-4-6",
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
