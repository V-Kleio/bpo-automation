"use client";
// Public API mirroring lib/mock/ai-engine.ts. When the /api/config endpoint
// reports anthropic.configured=true, calls go to the real route. Otherwise
// they fall through to the existing mock so the demo keeps working without
// any env vars.

import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/utils";
import {
  analyzeLeads as analyzeLeadsMock,
  streamAskAI as streamAskAIMock,
} from "@/lib/mock/ai-engine";
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
}

export async function analyzeLeads(companyIds: string[]): Promise<void> {
  if (!(await isAnthropicConfigured())) {
    return analyzeLeadsMock(companyIds);
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
    toast.error("Claude unavailable — using local fallback", {
      description: err instanceof Error ? err.message : String(err),
    });
    return fallbackToMock(companyIds);
  }

  if (!response.ok || !response.body) {
    const detail = await safeReadText(response);
    toast.error("Claude returned an error — using local fallback", {
      description: detail || `HTTP ${response.status}`,
    });
    return fallbackToMock(companyIds);
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
      `${failed.length} lead(s) failed Claude analysis — used local fallback`,
    );
    await analyzeLeadsMock(failed);
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
    },
  });
}

async function fallbackToMock(companyIds: string[]): Promise<void> {
  // Re-run mock for any companies that were left in analyzing state.
  const state = useStore.getState();
  const stillAnalyzing = companyIds.filter((id) => {
    const c = state.companies.find((x) => x.id === id);
    return c?.status === "analyzing";
  });
  if (stillAnalyzing.length > 0) {
    await analyzeLeadsMock(stillAnalyzing);
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
    yield* streamAskAIMock(prompt, contextCompanyIds);
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
  } catch {
    yield* streamAskAIMock(prompt, contextCompanyIds);
    return;
  }

  if (!response.ok || !response.body) {
    toast.error("Claude chat error — using local fallback");
    yield* streamAskAIMock(prompt, contextCompanyIds);
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
