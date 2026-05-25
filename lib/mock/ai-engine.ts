"use client";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/utils";
import {
  ROLE_TO_STEP,
  type AIAnalysis,
  type Channel,
  type Company,
  type GeneratedMessage,
  type Stakeholder,
} from "@/lib/types";

// Deterministic-but-realistic scoring driven by tier + intent signals + headcount.
function score(company: Company): AIAnalysis {
  const tierBase = company.tier === "priority" ? 78 : company.tier === "warm" ? 62 : 48;
  const signalBoost = company.intentSignals.reduce(
    (acc, s) =>
      acc + (s.strength === "strong" ? 6 : s.strength === "moderate" ? 3 : 1),
    0,
  );
  const headcountBoost = Math.min(8, Math.floor(company.headcount / 1000));
  const priorityScore = Math.min(
    99,
    Math.max(20, tierBase + signalBoost + headcountBoost - 2),
  );

  const industryFitScore = company.industry.some((i) =>
    /banking|finance|insurance|fintech|telecom|bfsi|cx/i.test(i),
  )
    ? 88 + (Math.abs(hash(company.id)) % 8)
    : 60 + (Math.abs(hash(company.id)) % 15);

  const operationalPainScore =
    50 +
    (company.intentSignals.find((s) => s.type === "hiring")?.strength === "strong"
      ? 35
      : company.intentSignals.find((s) => s.type === "hiring")
      ? 22
      : 8) +
    Math.min(10, Math.floor(company.headcount / 800));

  const digitalMaturityScore =
    45 +
    (company.intentSignals.find((s) => s.type === "digital_transformation")
      ? 30
      : 0) +
    (company.intentSignals.find((s) => s.type === "tech_adoption") ? 18 : 0);

  const buyingSignalsScore =
    40 +
    company.intentSignals.length * 10 +
    (Math.abs(hash(company.id + "buy")) % 12);

  const budgetPotentialScore =
    company.tier === "priority"
      ? 80 + (Math.abs(hash(company.id + "bud")) % 12)
      : company.tier === "warm"
      ? 60 + (Math.abs(hash(company.id + "bud")) % 15)
      : 40 + (Math.abs(hash(company.id + "bud")) % 18);

  return {
    priorityScore,
    qualification: {
      industryFit: {
        score: clamp(industryFitScore),
        reasoning: `${company.name} operates in ${company.industry.join(
          ", ",
        )} — ${
          industryFitScore > 80
            ? "directly within Wiz.AI's core ICP (BFSI / Telecom / CX)."
            : "adjacent verticals where Wiz.AI has reference customers."
        }`,
      },
      operationalPain: {
        score: clamp(operationalPainScore),
        reasoning: `${company.headcount.toLocaleString()} employees. ${
          company.intentSignals.find((s) => s.type === "hiring")
            ? "Active hiring of contact-center agents signals scaling pain typically solved by voice AI."
            : "Headcount alone implies measurable manual workload in agent operations."
        }`,
      },
      digitalMaturity: {
        score: clamp(digitalMaturityScore),
        reasoning: company.intentSignals.some(
          (s) =>
            s.type === "digital_transformation" || s.type === "tech_adoption",
        )
          ? "Public signals of digital transformation initiatives — buyer is already in a 'modernize the stack' frame of mind."
          : "Limited public DX signals; would need a discovery call to assess.",
      },
      buyingSignals: {
        score: clamp(buyingSignalsScore),
        reasoning: `Detected ${company.intentSignals.length} active intent signal(s): ${
          company.intentSignals.map((s) => s.label).join(", ") || "none"
        }.`,
      },
      budgetPotential: {
        score: clamp(budgetPotentialScore),
        reasoning:
          company.tier === "priority"
            ? "Enterprise-scale operations imply six-figure ACV is plausible."
            : company.tier === "warm"
            ? "Mid-market budget — pilot deals likely in the $20-50k range."
            : "SMB tier — fit for self-serve or low-touch pilot.",
      },
    },
    partnership: {
      strategicAlignment: `Wiz.AI's conversational voice agents directly address ${company.name}'s exposure in ${
        company.industry[0] ?? "customer operations"
      }. ${company.whyTarget}`,
      aiReadiness:
        company.intentSignals.some(
          (s) =>
            s.type === "digital_transformation" || s.type === "tech_adoption",
        )
          ? "High — existing DX program means infrastructure and change-management muscle are already in place."
          : "Medium — would benefit from a guided POC to demonstrate ROI before broader rollout.",
      growthPotential: `Account expansion path: start with one BFSI client of theirs (~3 use cases), expand to 5+ clients within 12 months as agent productivity gains compound.`,
      localizationFit:
        "Wiz.AI's Bahasa Indonesia and Javanese voice models are production-ready — no localization gap.",
    },
    generatedMessages: [],
    analyzedAt: new Date().toISOString(),
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(99, Math.round(n)));
}

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h | 0;
}

// 4-step message templates aligned with the PDF's outreach strategy.
const MESSAGE_TEMPLATES: Record<
  1 | 2 | 3 | 4,
  { linkedinDM: (c: Company, s: Stakeholder) => string;
    email: (c: Company, s: Stakeholder) => { subject: string; body: string };
  }
> = {
  1: {
    linkedinDM: (c, s) =>
      `Hi ${s.name.split(" ")[0]} — saw your work running ${
        c.name
      } operations. Wiz.AI is helping BPOs like yours reduce manual agent workload by ~70% using Bahasa-native voice AI. Worth a quick 15-min chat?`,
    email: (c, s) => ({
      subject: `Cutting agent workload at ${c.name} by 70%`,
      body: `Hi ${s.name.split(" ")[0]},\n\nFrontline ops teams at Indonesian BPOs typically lose 30–40% of agent hours to repeatable Tier-1 calls. Wiz.AI's voice AI handles those in Bahasa and Javanese, with full handoff to a human when needed.\n\nWith ${c.headcount.toLocaleString()} agents under your roof at ${c.name}, even a 20% deflection compounds to material EBITDA impact.\n\nWould a 15-min walkthrough next week be useful?\n\n— Wiz.AI Partnerships`,
    }),
  },
  2: {
    linkedinDM: (c, s) =>
      `Hi ${s.name.split(" ")[0]} — your team showed us the operational gaps inside ${
        c.name
      }. I'd love 20 mins to walk through the ROI model we built for a Telkom-group peer. Open to a quick intro?`,
    email: (c, s) => ({
      subject: `The ROI model your team asked us to build for ${c.name}`,
      body: `Hi ${s.name.split(" ")[0]},\n\nThe ops team at ${c.name} flagged where AI deflection would have the biggest dollar impact — I've turned that into a per-quarter ROI model.\n\nHeadline: at your scale, ~$1.2M annual cost savings is conservative. Happy to share the working spreadsheet ahead of a call.\n\nIs there a 20-min slot next week that works?\n\n— Wiz.AI Partnerships`,
    }),
  },
  3: {
    linkedinDM: (c, s) =>
      `Hi ${s.name.split(" ")[0]} — looping you in early. Our API integrates with the existing CRM/contact-center stack at ${
        c.name
      } (REST + webhooks, OJK-compliant data residency). Worth a 30-min architecture review?`,
    email: (c, s) => ({
      subject: `Integration architecture for ${c.name} — quick review`,
      body: `Hi ${s.name.split(" ")[0]},\n\nLooping in early so vendor due diligence is never a last-minute blocker.\n\n• REST + webhook API; SSO via SAML/OIDC\n• Data residency: Jakarta region (OJK-compliant)\n• Pre-built connectors for Genesys, Avaya, Five9, and a thin adapter pattern for in-house stacks\n• SOC 2 Type II + ISO 27001\n\nCould we book a 30-min review with your team this month?\n\n— Wiz.AI Solutions Engineering`,
    }),
  },
  4: {
    linkedinDM: (c, s) =>
      `Hi ${s.name.split(" ")[0]} — your COO + Head of CX have validated the use case at ${
        c.name
      }. Looking for 20 mins to align on a multi-year partnership scope. Open to a chat?`,
    email: (c, s) => ({
      subject: `Final alignment — ${c.name} × Wiz.AI partnership`,
      body: `Hi ${s.name.split(" ")[0]},\n\nYour COO and Head of CX have validated both the operational fit and the integration path. We're ready to scope a multi-year partnership.\n\nProposing a 20-min call so we can align on commercial structure and a co-marketed rollout. Open to next Wednesday?\n\n— Wiz.AI Partnerships`,
    }),
  },
};

function generateMessages(
  company: Company,
  stakeholders: Stakeholder[],
): GeneratedMessage[] {
  const out: GeneratedMessage[] = [];
  for (const st of stakeholders) {
    const step = ROLE_TO_STEP[st.role];
    const tpl = MESSAGE_TEMPLATES[step];
    out.push({
      id: uid("msg"),
      stakeholderId: st.id,
      channel: "linkedin",
      body: tpl.linkedinDM(company, st),
      step,
    });
    const e = tpl.email(company, st);
    out.push({
      id: uid("msg"),
      stakeholderId: st.id,
      channel: "email",
      subject: e.subject,
      body: e.body,
      step,
    });
  }
  return out;
}

export async function analyzeLeads(companyIds: string[]): Promise<void> {
  const state = useStore.getState();
  for (const id of companyIds) {
    const company = state.companies.find((c) => c.id === id);
    if (!company) continue;
    state.setLeadStatus(id, "analyzing");
    state.log({
      layer: 2,
      type: "ai_call",
      summary: `Started Claude analysis for ${company.name}`,
      companyId: id,
    });
    // Simulated latency
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));

    const fresh = useStore.getState().companies.find((c) => c.id === id);
    if (!fresh) continue;
    const stakeholders = useStore
      .getState()
      .stakeholders.filter((s) => s.companyId === id);
    const analysis = score(fresh);
    analysis.generatedMessages = generateMessages(fresh, stakeholders);

    useStore.getState().setAnalysis(id, analysis);
    useStore.getState().log({
      layer: 2,
      type: "ai_call",
      summary: `Claude returned priority score ${analysis.priorityScore} for ${fresh.name}`,
      companyId: id,
      meta: { priorityScore: analysis.priorityScore },
    });
  }
}

// Streaming chat: yields tokens, intended for components to consume.
export async function* streamAskAI(
  prompt: string,
  contextCompanyIds: string[],
): AsyncGenerator<string, void, void> {
  const state = useStore.getState();
  const contextCompanies = contextCompanyIds
    .map((id) => state.companies.find((c) => c.id === id))
    .filter((c): c is Company => !!c);

  const reply = composeChatReply(prompt, contextCompanies);
  // Split into ~3-5 char chunks for a streamy feel
  const chunks = reply.match(/[\s\S]{1,5}/g) ?? [reply];
  for (const ch of chunks) {
    await new Promise((r) => setTimeout(r, 25 + Math.random() * 35));
    yield ch;
  }
}

function composeChatReply(prompt: string, companies: Company[]): string {
  const lower = prompt.toLowerCase();
  const top = companies[0];
  const list =
    companies.length > 0
      ? companies.map((c) => `**${c.name}** (${c.tier})`).join(", ")
      : "the seed dataset of 20 Indonesian BPOs";

  if (/why.*fit|why.*target|why.*priority/.test(lower) && top) {
    return `Quick read on ${top.name}:\n\n• **Tier:** ${top.tier.toUpperCase()} — ${top.whyTarget}\n• **Headcount:** ${top.headcount.toLocaleString()} — implies meaningful manual agent workload.\n• **Intent signals:** ${
      top.intentSignals.map((s) => s.label).join("; ") || "none yet detected"
    }.\n• **Recommendation:** Start the outreach sequence from the Operational Champion (Step 1) — that's the path that converts fastest based on similar accounts.`;
  }

  if (/draft|write|message|dm|email/.test(lower)) {
    return `Here's a follow-up angle worth testing for ${list}:\n\n> "Wanted to share a 2-page rundown of how a Telkom-group BPO peer achieved ~$1.2M in annual savings within 6 months of deploying Wiz.AI voice agents. Open to a 15-min walkthrough next week?"\n\nThis works because it (a) name-drops a peer in the same ownership structure, (b) leads with a specific dollar outcome, and (c) asks for a low-commitment 15-min slot.`;
  }

  if (/score|priority|rank/.test(lower)) {
    const ranked = [...companies]
      .sort(
        (a, b) =>
          (b.analysis?.priorityScore ?? 0) - (a.analysis?.priorityScore ?? 0),
      )
      .slice(0, 5);
    return `Ranked by current priority score:\n\n${
      ranked
        .map(
          (c, i) =>
            `${i + 1}. **${c.name}** — ${c.analysis?.priorityScore ?? "—"} (${c.tier})`,
        )
        .join("\n") || "No companies analyzed yet — run analysis from the Leads page first."
    }`;
  }

  if (/next|action|step/.test(lower)) {
    return `Suggested next actions across the selected set (${list}):\n\n1. Push the top 3 priority leads into a campaign.\n2. Launch Step 1 outreach (LinkedIn DM to the Operational Champion) — that's the validated entry point.\n3. Set a follow-up trigger: if no reply within 5 business days, hand the same lead to the email sequence.\n4. Reserve the CDO/COO outreach (Step 2) for *after* the Champion has acknowledged.`;
  }

  return `Looking at ${list}, here's a quick framing:\n\n${
    top
      ? `${top.name} is a ${top.tier} target — ${top.whyTarget}\n\n`
      : ""
  }Ask me about (a) why a specific company is a fit, (b) how to draft a follow-up message, (c) the current priority ranking, or (d) what to do next.`;
}
