import type { AIAnalysis, Company, Stakeholder } from "@/lib/types";

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
  return [
    `qualification:`,
    `  industryFit ${a.qualification.industryFit.score} — ${a.qualification.industryFit.reasoning}`,
    `  operationalPain ${a.qualification.operationalPain.score} — ${a.qualification.operationalPain.reasoning}`,
    `  digitalMaturity ${a.qualification.digitalMaturity.score} — ${a.qualification.digitalMaturity.reasoning}`,
    `  buyingSignals ${a.qualification.buyingSignals.score} — ${a.qualification.buyingSignals.reasoning}`,
    `  budgetPotential ${a.qualification.budgetPotential.score} — ${a.qualification.budgetPotential.reasoning}`,
    `partnership:`,
    `  strategicAlignment: ${a.partnership.strategicAlignment}`,
    `  aiReadiness: ${a.partnership.aiReadiness}`,
    `  growthPotential: ${a.partnership.growthPotential}`,
    `  localizationFit: ${a.partnership.localizationFit}`,
  ].join("\n");
}
