import { uid } from "@/lib/utils";
import type {
  Company,
  Stakeholder,
  StakeholderRole,
  StakeholderPriority,
} from "@/lib/types";

export interface HubSpotContactProperties {
  firstname?: string;
  lastname?: string;
  email?: string;
  jobtitle?: string;
  company?: string;
  hs_linkedin_url?: string;
  linkedin?: string;
}

export interface HubSpotContactRecord {
  id: string;
  properties: HubSpotContactProperties;
}

export interface ContactsConversionOutput {
  companies: Company[];
  stakeholders: Stakeholder[];
  skipped: number;
}

const ROLE_PATTERNS: Array<{ test: RegExp; role: StakeholderRole }> = [
  { test: /\b(ceo|founder|co[\s-]?founder|owner|president|managing director)\b/i, role: "ceo" },
  { test: /\b(cto|cio|vp eng|head of (it|tech|engineering|product)|chief technology|chief information)\b/i, role: "technical_gatekeeper" },
  { test: /\b(cfo|coo|vp |vice president|head of (operations|finance|sales|growth)|director of |chief (financial|operating|revenue))\b/i, role: "economic_buyer" },
];

function deriveRole(jobtitle: string | undefined, fallbackIndex: number): StakeholderRole {
  if (jobtitle) {
    for (const { test, role } of ROLE_PATTERNS) {
      if (test.test(jobtitle)) return role;
    }
  }
  const cycle: StakeholderRole[] = [
    "champion",
    "economic_buyer",
    "technical_gatekeeper",
    "ceo",
  ];
  return cycle[fallbackIndex % cycle.length];
}

function derivePriority(role: StakeholderRole): StakeholderPriority {
  switch (role) {
    case "ceo":
    case "economic_buyer":
      return "high";
    case "technical_gatekeeper":
      return "medium";
    default:
      return "medium";
  }
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function fullName(p: HubSpotContactProperties, fallback: string): string {
  const parts = [p.firstname, p.lastname].map((x) => (x ?? "").trim()).filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  if (p.email) return p.email.split("@")[0];
  return fallback;
}

function pickLinkedIn(p: HubSpotContactProperties): string | undefined {
  // Prefer the custom `linkedin` field (user-populated) over the
  // HubSpot-enriched `hs_linkedin_url` when both exist.
  const candidate = [p.linkedin, p.hs_linkedin_url]
    .map((x) => (x ?? "").trim())
    .find((x) => x.length > 0);
  return candidate || undefined;
}

export function hubspotContactsToCompanies(
  records: HubSpotContactRecord[],
): ContactsConversionOutput {
  const companiesByKey = new Map<string, Company>();
  const stakeholdersByCompany = new Map<string, Stakeholder[]>();
  let skipped = 0;

  for (const rec of records) {
    const p = rec.properties ?? {};
    const companyName = (p.company ?? "").trim();
    if (!companyName) {
      // Contacts with no parent company can't be qualified as leads in this app.
      skipped += 1;
      continue;
    }

    const key = companyName.toLowerCase();
    let company = companiesByKey.get(key);
    if (!company) {
      company = {
        id: `co_hs_${slug(companyName)}_${uid("").slice(2, 6)}`,
        name: companyName,
        industry: ["Unknown"],
        size: "Size unknown",
        headcount: 0,
        hq: "Unknown",
        tier: "nurture",
        whyTarget:
          "Pulled from HubSpot — pending qualification by AI Intelligence.",
        intentSignals: [],
        status: "pending_analysis",
      };
      companiesByKey.set(key, company);
      stakeholdersByCompany.set(company.id, []);
    }

    const existing = stakeholdersByCompany.get(company.id) ?? [];
    const role = deriveRole(p.jobtitle, existing.length);
    const name = fullName(p, "HubSpot Contact");
    const stakeholder: Stakeholder = {
      id: `st_hs_${rec.id}`,
      companyId: company.id,
      name,
      title: (p.jobtitle ?? "").trim() || "Contact",
      role,
      priority: derivePriority(role),
      whyTarget: "Pulled from HubSpot — pending outreach plan.",
      linkedinUrl: pickLinkedIn(p),
      email: (p.email ?? "").trim() || undefined,
    };
    existing.push(stakeholder);
    stakeholdersByCompany.set(company.id, existing);
  }

  const companies = Array.from(companiesByKey.values());
  const stakeholders: Stakeholder[] = [];
  for (const list of stakeholdersByCompany.values()) {
    stakeholders.push(...list);
  }

  return { companies, stakeholders, skipped };
}
