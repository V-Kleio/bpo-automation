import type { Company, Stakeholder } from "@/lib/types";

export function buildAnalyzeUserPrompt(
  company: Company,
  stakeholders: Stakeholder[],
): string {
  const signals =
    company.intentSignals.length === 0
      ? "  (none detected yet — rely on web_search)"
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

  return `COMPANY FACTS (from CRM / CSV — may be sparse, treat as a starting point)

  name: ${company.name}
  industry: ${company.industry.join(", ")}
  headcount: ${company.headcount > 0 ? company.headcount.toLocaleString() : "(unknown — research)"}
  hq: ${company.hq}
  current-tier-guess: ${company.tier}
  website: ${company.website ?? "(unknown — research)"}
  whyTarget: ${company.whyTarget}

  intent signals on file:
${signals}

STAKEHOLDERS
${stakeholderLines}

TASK
1. Search the public web for current information about "${company.name}" in Indonesia. Confirm or correct the facts above and fill in unknowns (headcount, contact-center scale, recent news, CRM/tech stack, regulatory posture, AI adoption signals).
2. Score the company against all nine WIZ.AI criteria (0-10 each).
3. Compute the overall priorityScore (0-100).
4. Write the partnership block grounded in what you found.
5. Draft the full 4-step outreach sequence (one LinkedIn DM + one Email per stakeholder per their step).
6. Call submit_lead_analysis exactly once with the complete payload, including a webResearchSummary capturing what your searches actually revealed.`;
}
