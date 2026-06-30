"use client";
// Client-facing API for AI analysis + chat. Talks to /api/analyze-leads and
// /api/ask-claude. No mock fallback — when no AI provider is configured the
// UI surfaces a hard error and refuses to run.

import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/utils";
import { getClientConfig } from "./public-config-client";
import type { AIAnalysis, Company, Stakeholder } from "@/lib/types";

async function isAIConfigured(): Promise<boolean> {
  try {
    const cfg = await getClientConfig();
    return cfg.ai.configured;
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

export interface AnalyzeResult {
  succeeded: string[];
  failed: Array<{ id: string; name: string; error: string }>;
}

export async function analyzeLeads(
  companyIds: string[],
): Promise<AnalyzeResult> {
  if (!(await isAIConfigured())) {
    toast.error("AI provider is not configured", {
      description:
        "Pick a provider and add credentials on the Settings page (Anthropic, or any OpenAI-compatible endpoint).",
    });
    throw new AIUnavailableError("AI provider not configured");
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
    summary: `Sent ${companyIds.length} lead(s) to the AI provider for analysis`,
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
    toast.error("AI request failed", { description: message });
    revertAnalyzingStatus(companyIds);
    throw err;
  }

  if (!response.ok || !response.body) {
    const detail = await safeReadText(response);
    toast.error("AI provider returned an error", {
      description: detail || `HTTP ${response.status}`,
    });
    revertAnalyzingStatus(companyIds);
    throw new Error(`AI provider HTTP ${response.status}: ${detail}`);
  }

  const succeeded: string[] = [];
  const failed: AnalyzeResult["failed"] = [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
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
          handleLine(parsed, succeeded, failed);
        } catch {
          // skip unparseable line
        }
      }
    }
    if (buffer.trim()) {
      try {
        handleLine(JSON.parse(buffer) as AnalyzeLine, succeeded, failed);
      } catch {
        // ignore trailing garbage
      }
    }
  } catch (err) {
    // The stream was interrupted before every lead came back — e.g. the user
    // navigated away (full reload) or a network drop mid-batch. Swallow it so
    // the batch doesn't throw; the finally below rescues any in-flight lead.
    console.warn("[analyzeLeads] stream interrupted:", err);
  } finally {
    // Revert every lead that didn't get a successful analysis (failed OR never
    // returned because the stream was cut) from "analyzing" back to
    // "pending_analysis", so a row is never left stuck mid-flight.
    revertAnalyzingStatus(companyIds.filter((id) => !succeeded.includes(id)));
  }
  return { succeeded, failed };
}

function handleLine(
  line: AnalyzeLine,
  succeeded: string[],
  failed: AnalyzeResult["failed"],
): void {
  const store = useStore.getState();
  const company = store.companies.find((c) => c.id === line.companyId);
  const name = company?.name ?? line.companyId;
  if (line.error || !line.analysis) {
    const err = line.error || "AI provider returned no analysis";
    console.error(`[analyzeLeads] ${name} (${line.companyId}) failed:`, err);
    failed.push({ id: line.companyId, name, error: err });
    store.log({
      layer: 2,
      type: "ai_call",
      summary: `AI analysis FAILED for ${name}: ${err}`,
      companyId: line.companyId,
      meta: { mode: "real", error: err },
    });
    return;
  }
  store.setAnalysis(line.companyId, line.analysis);
  store.log({
    layer: 2,
    type: "ai_call",
    summary: `AI returned priorityScore ${line.analysis.priorityScore} for ${name}`,
    companyId: line.companyId,
    meta: {
      mode: "real",
      model: line.model,
      durationMs: line.durationMs,
      webSearchCount: line.webSearchCount,
    },
  });
  succeeded.push(line.companyId);
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
  if (!(await isAIConfigured())) {
    yield "AI provider is not configured. Pick a provider and add credentials on the Settings page (Anthropic, or any OpenAI-compatible endpoint).";
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
    yield `\n\n[AI request failed: ${message}]`;
    return;
  }

  if (!response.ok || !response.body) {
    const detail = await safeReadText(response);
    yield `\n\n[AI error: ${detail || `HTTP ${response.status}`}]`;
    return;
  }

  state.log({
    layer: 2,
    type: "ai_call",
    summary: `Streaming chat reply from the AI provider`,
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
