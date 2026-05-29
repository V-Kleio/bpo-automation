"use client";
// Client-facing API for AI analysis + chat. Talks to /api/analyze-leads and
// /api/ask-claude. No mock fallback — when Anthropic is not configured the
// UI surfaces a hard error and refuses to run.

import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/utils";
import { getClientConfig } from "./public-config-client";
import type { AIAnalysis, Company, Stakeholder } from "@/lib/types";

async function isAnthropicConfigured(): Promise<boolean> {
  try {
    const cfg = await getClientConfig();
    return cfg.anthropic.configured;
  } catch {
    return false;
  }
}

interface AnalyzeLine {
  companyId: string;
  analysis?: AIAnalysis;
  error?: string;
  model?: string;
  durationMs?: number;
  webSearchCount?: number;
}

export class AIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIUnavailableError";
  }
}

export async function analyzeLeads(companyIds: string[]): Promise<void> {
  if (!(await isAnthropicConfigured())) {
    toast.error("Claude is not configured", {
      description:
        "Set ANTHROPIC_AUTH_TOKEN (Claude Max) or ANTHROPIC_API_KEY in .env.local and restart.",
    });
    throw new AIUnavailableError("Anthropic not configured");
  }

  const state = useStore.getState();
  const companies = companyIds
    .map((id) => state.companies.find((c) => c.id === id))
    .filter((c): c is Company => !!c);
  const stakeholders = state.stakeholders.filter((s) =>
    companyIds.includes(s.companyId),
  );

  for (const id of companyIds) {
    state.setLeadStatus(id, "analyzing");
  }
  state.log({
    layer: 2,
    type: "ai_call",
    summary: `Sent ${companyIds.length} lead(s) to Claude for analysis`,
    meta: { mode: "real" },
  });

  let response: Response;
  try {
    response = await fetch("/api/analyze-leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ companies, stakeholders }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    toast.error("Claude request failed", { description: message });
    revertAnalyzingStatus(companyIds);
    throw err;
  }

  if (!response.ok || !response.body) {
    const detail = await safeReadText(response);
    toast.error("Claude returned an error", {
      description: detail || `HTTP ${response.status}`,
    });
    revertAnalyzingStatus(companyIds);
    throw new Error(`Claude HTTP ${response.status}: ${detail}`);
  }

  const failed: string[] = [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const parsed = JSON.parse(line) as AnalyzeLine;
        handleLine(parsed, failed);
      } catch {
        // skip unparseable line
      }
    }
  }
  if (buffer.trim()) {
    try {
      handleLine(JSON.parse(buffer) as AnalyzeLine, failed);
    } catch {
      // ignore trailing garbage
    }
  }

  if (failed.length > 0) {
    toast.warning(
      `${failed.length} lead(s) failed Claude analysis — leave them pending and retry.`,
    );
    revertAnalyzingStatus(failed);
  }
}

function handleLine(line: AnalyzeLine, failed: string[]): void {
  if (line.error || !line.analysis) {
    failed.push(line.companyId);
    return;
  }
  const store = useStore.getState();
  const company = store.companies.find((c) => c.id === line.companyId);
  store.setAnalysis(line.companyId, line.analysis);
  store.log({
    layer: 2,
    type: "ai_call",
    summary: `Claude returned priorityScore ${line.analysis.priorityScore} for ${company?.name ?? line.companyId}`,
    companyId: line.companyId,
    meta: {
      mode: "real",
      model: line.model,
      durationMs: line.durationMs,
      webSearchCount: line.webSearchCount,
    },
  });
}

function revertAnalyzingStatus(ids: string[]): void {
  const state = useStore.getState();
  for (const id of ids) {
    const c = state.companies.find((x) => x.id === id);
    if (c?.status === "analyzing") {
      state.setLeadStatus(id, "pending_analysis");
    }
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 200);
  } catch {
    return "";
  }
}

export async function* streamAskAI(
  prompt: string,
  contextCompanyIds: string[],
): AsyncGenerator<string, void, void> {
  if (!(await isAnthropicConfigured())) {
    yield "Claude is not configured. Set ANTHROPIC_AUTH_TOKEN (Claude Max) or ANTHROPIC_API_KEY in .env.local and restart.";
    return;
  }

  const state = useStore.getState();
  const contextCompanies = contextCompanyIds
    .map((id) => state.companies.find((c) => c.id === id))
    .filter((c): c is Company => !!c);
  const contextStakeholders: Stakeholder[] = state.stakeholders.filter((s) =>
    contextCompanyIds.includes(s.companyId),
  );

  let response: Response;
  try {
    response = await fetch("/api/ask-claude", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt,
        contextCompanies,
        contextStakeholders,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    yield `\n\n[Claude request failed: ${message}]`;
    return;
  }

  if (!response.ok || !response.body) {
    const detail = await safeReadText(response);
    yield `\n\n[Claude error: ${detail || `HTTP ${response.status}`}]`;
    return;
  }

  state.log({
    layer: 2,
    type: "ai_call",
    summary: `Streaming chat reply from Claude`,
    meta: { mode: "real", chatId: uid("chat-call") },
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}
