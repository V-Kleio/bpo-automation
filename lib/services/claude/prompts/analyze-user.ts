import type { Company, Stakeholder } from "@/lib/types";

export function buildAnalyzeUserPrompt(
  company: Company,
  stakeholders: Stakeholder[],
): string {
  const signals =
    company.intentSignals.length === 0
      ? "  (none detected yet)"
      : company.intentSignals
          .map((s) => `  - ${s.label} (${s.type}, strength: ${s.strength})`)
          .join("\n");

  const stakeholderLines =
    stakeholders.length === 0
      ? "  (no stakeholders mapped — generate no messages)"
      : stakeholders
          .map(
            (s) =>
              `  - id=${s.id} | role=${s.role} | name="${s.name}" | title="${s.title}" | priority=${s.priority}` +
              (s.linkedinUrl ? ` | linkedin=${s.linkedinUrl}` : "") +
              (s.email ? ` | email=${s.email}` : "") +
              `\n    why-target: ${s.whyTarget}`,
          )
          .join("\n");

  return `COMPANY FACTS

  name: ${company.name}
  industry: ${company.industry.join(", ")}
  headcount: ${company.headcount.toLocaleString()}
  hq: ${company.hq}
  tier: ${company.tier}
  website: ${company.website ?? "(unknown)"}
  whyTarget: ${company.whyTarget}

  intent signals:
${signals}

STAKEHOLDERS
${stakeholderLines}

TASK

Score this company across all five qualification dimensions, write the partnership analysis, and draft the full 4-step outreach sequence (one LinkedIn DM + one email per stakeholder per their step). Call submit_lead_analysis exactly once with the complete payload.`;
}
