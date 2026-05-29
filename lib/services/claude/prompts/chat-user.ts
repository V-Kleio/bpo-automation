import type { AIAnalysis, Company, Stakeholder } from "@/lib/types";
import { WIZ_CRITERIA } from "../wiz-criteria";

interface ChatContext {
  companies: Company[];
  stakeholders: Stakeholder[];
}

export function buildChatUserPrompt(
  userPrompt: string,
  context: ChatContext,
): string {
  if (context.companies.length === 0) {
    return `USER PROMPT
${userPrompt}

(No companies are currently selected as context.)`;
  }

  const blocks: string[] = ["CONTEXT — companies in scope:\n"];
  for (const c of context.companies) {
    const sts = context.stakeholders.filter((s) => s.companyId === c.id);
    blocks.push(`### ${c.name} (id: ${c.id})`);
    blocks.push(
      `tier: ${c.tier} | hq: ${c.hq} | headcount: ${c.headcount.toLocaleString()} | industry: ${c.industry.join(", ")}`,
    );
    blocks.push(`whyTarget: ${c.whyTarget}`);
    if (c.intentSignals.length > 0) {
      blocks.push(
        `intent signals: ${c.intentSignals.map((s) => `${s.label} (${s.strength})`).join("; ")}`,
      );
    }
    if (c.analysis) {
      blocks.push(`priorityScore: ${c.analysis.priorityScore}`);
      blocks.push(formatAnalysisSummary(c.analysis));
    }
    if (sts.length > 0) {
      blocks.push("stakeholders:");
      for (const s of sts) {
        blocks.push(`  - ${s.name} (${s.role}, ${s.title})`);
      }
    }
    blocks.push("");
  }

  blocks.push("USER PROMPT\n" + userPrompt);
  return blocks.join("\n");
}

function formatAnalysisSummary(a: AIAnalysis): string {
  const lines: string[] = ["qualification (0-10 per criterion):"];
  for (const c of WIZ_CRITERIA) {
    const dim = a.qualification[c.key];
    lines.push(`  ${c.label.padEnd(28)} ${dim.score}/10 — ${dim.reasoning}`);
  }
  lines.push("partnership:");
  lines.push(`  strategicAlignment: ${a.partnership.strategicAlignment}`);
  lines.push(`  aiReadiness: ${a.partnership.aiReadiness}`);
  lines.push(`  growthPotential: ${a.partnership.growthPotential}`);
  lines.push(`  localizationFit: ${a.partnership.localizationFit}`);
  if (a.webResearchSummary) {
    lines.push(`webResearchSummary: ${a.webResearchSummary}`);
  }
  return lines.join("\n");
}
