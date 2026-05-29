// Wiz.AI permanent context — sourced verbatim from `Wiz Product and Criteria.pdf`.
// Every Claude call (analyze + chat) embeds this block in the cached system
// prompt so the model scores leads against WIZ.AI's actual product and tier
// rules instead of inferring them from training data.

export const WIZ_CRITERION_KEYS = [
  "callVolume",
  "costPressure",
  "useCaseFit",
  "budgetCapacity",
  "digitalMaturity",
  "regulatoryFit",
  "languageNeed",
  "channelPartnerLeverage",
  "competitiveWhitespace",
] as const;

export type WizCriterionKey = (typeof WIZ_CRITERION_KEYS)[number];

export interface WizCriterionDef {
  key: WizCriterionKey;
  no: number;
  label: string;
  whatToLookFor: string;
}

export const WIZ_CRITERIA: WizCriterionDef[] = [
  {
    key: "callVolume",
    no: 1,
    label: "Call/Contact Volume",
    whatToLookFor: "High inbound or outbound interaction volume",
  },
  {
    key: "costPressure",
    no: 2,
    label: "Cost Pressure",
    whatToLookFor: "Large agent headcount, attrition, rising labor cost",
  },
  {
    key: "useCaseFit",
    no: 3,
    label: "Use-Case Fit",
    whatToLookFor:
      "Clear inbound (support/FAQ) or outbound (collections/telesales/reminders) workload",
  },
  {
    key: "budgetCapacity",
    no: 4,
    label: "Budget Capacity",
    whatToLookFor: "Mid-to-large enterprise tech spend",
  },
  {
    key: "digitalMaturity",
    no: 5,
    label: "Digital Maturity",
    whatToLookFor: "Has CRM, open to AI/automation",
  },
  {
    key: "regulatoryFit",
    no: 6,
    label: "Regulatory Fit",
    whatToLookFor: "OJK/POJK/Kominfo-compliant where automation is allowed",
  },
  {
    key: "languageNeed",
    no: 7,
    label: "Language Need",
    whatToLookFor: "Bahasa Indonesia / regional language requirement",
  },
  {
    key: "channelPartnerLeverage",
    no: 8,
    label: "Channel/Partner Leverage",
    whatToLookFor: "SI or BPO that can resell or embed WIZ.AI",
  },
  {
    key: "competitiveWhitespace",
    no: 9,
    label: "Competitive Whitespace",
    whatToLookFor: "Underserved by local AI vendors",
  },
];

// Tier mapping is on the AVERAGE of the 9 criterion scores (each 0-10).
// We surface tier-as-Company.tier (priority|warm|nurture) plus a "skip"
// signal that the route turns into LeadStatus="disqualified".
export type WizTier = "tier1" | "tier2" | "tier3" | "skip";

export function tierFromAverage(avg: number): WizTier {
  if (avg >= 9) return "tier1";
  if (avg >= 7) return "tier2";
  if (avg >= 5) return "tier3";
  return "skip";
}

export const WIZ_PRODUCT_CONTEXT = `WIZ.AI — PRODUCT AND CRITERIA (canonical)

PRODUCT
WIZ.AI provides enterprise-grade conversational AI for customer engagement, with two core offerings:
  - AI Inbound — handles incoming customer interactions (voice/chat) with human-like agents that resolve queries, qualify leads, and reduce live-agent load.
  - Talkbot Outbound — automated outbound voice campaigns for collections, sales, surveys, reminders, and follow-ups at scale.
Both run in local languages (Bahasa Indonesia, English, regional dialects) and integrate with CRMs, telephony, and contact-center stacks.

PROJECT GOAL
Identify and prioritize Indonesian industries/prospects most likely to buy AI Inbound + Talkbot Outbound — so outbound effort focuses on segments with the highest conversion potential.

PRIMARY BUYER PROFILE
  - BFSI — Banks, Multifinance, Insurance, Securities
  - Fintech — Digital lending, payments, e-wallets, neobanks
  - BPO / Contact Center Outsourcers
  - SI (System Integrators) — channel/reseller play
  - Telco
  - E-commerce & Marketplaces
  - Healthcare (hospital chains, insurance-linked)
  - Logistics & Courier
  - Utilities / PLN-adjacent
  - Government & SOE (BUMN)
  - Education (large EdTech, universities)
  - Travel & Hospitality

NINE-CRITERION RUBRIC (score each 0–10, integer)
  1. Call/Contact Volume       — High inbound or outbound interaction volume
  2. Cost Pressure             — Large agent headcount, attrition, rising labor cost
  3. Use-Case Fit              — Clear inbound (support/FAQ) or outbound (collections/telesales/reminders) workload
  4. Budget Capacity           — Mid-to-large enterprise tech spend
  5. Digital Maturity          — Has CRM, open to AI/automation
  6. Regulatory Fit            — OJK/POJK/Kominfo-compliant where automation is allowed
  7. Language Need             — Bahasa Indonesia / regional language requirement
  8. Channel/Partner Leverage  — SI or BPO that can resell or embed WIZ.AI
  9. Competitive Whitespace    — Underserved by local AI vendors

SCORING TIERS (apply to the AVERAGE of the nine scores)
  - Tier 1 (avg 9–10) Hot     — High volume + cost pressure + clear use case → e.g., Banks, Multifinance, Fintech lenders, Telco, large BPOs
  - Tier 2 (avg 7–8)  Warm    — Strong on 2–3 criteria                     → e.g., Insurance, E-commerce, Logistics, Healthcare, SI partners
  - Tier 3 (avg 5–6)  Nurture — Fit exists, volume/budget limited           → e.g., Education, Travel, Utilities, BUMN
  - Skip   (avg <5)           — Low volume, no use case, or regulatory blockers`;
