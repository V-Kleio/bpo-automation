import { uid } from "@/lib/utils";
import type {
  Company,
  Stakeholder,
  StakeholderRole,
  Tier,
} from "@/lib/types";
import type { ImportRow } from "./types";

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function deriveRole(idx: number, raw?: string): StakeholderRole {
  if (raw) {
    const norm = raw.toLowerCase().replace(/[\s-]+/g, "_");
    if (
      norm === "champion" ||
      norm === "economic_buyer" ||
      norm === "technical_gatekeeper" ||
      norm === "ceo"
    ) {
      return norm;
    }
  }
  const cycle: StakeholderRole[] = [
    "champion",
    "economic_buyer",
    "technical_gatekeeper",
    "ceo",
  ];
  return cycle[idx % cycle.length];
}

function nameFromLinkedInUrl(url: string): string {
  const m = url.match(/linkedin\.com\/in\/([\w\-_%.]+)/i);
  if (!m) return "Contact";
  return m[1]
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

const VALID_TIERS: ReadonlyArray<Tier> = ["priority", "warm", "nurture"];

export interface ConversionOutput {
  companies: Company[];
  stakeholders: Stakeholder[];
}

export function importRowsToCompanies(
  rows: ImportRow[],
  options: { idPrefix?: string } = {},
): ConversionOutput {
  const companies: Company[] = [];
  const stakeholders: Stakeholder[] = [];

  for (const row of rows) {
    const companySlug = slug(row.companyName);
    const companyId = `co_${options.idPrefix ?? "import"}_${companySlug}_${uid("").slice(2, 6)}`;

    const tier: Tier =
      row.tier && VALID_TIERS.includes(row.tier) ? row.tier : "warm";

    const company: Company = {
      id: companyId,
      name: row.companyName.trim(),
      industry: row.industry?.length ? row.industry : ["Unknown"],
      size: row.headcount
        ? `${row.headcount.toLocaleString()} employees`
        : "Size unknown",
      headcount: row.headcount ?? 0,
      hq: row.hq ?? "Unknown",
      tier,
      whyTarget:
        row.whyTarget ??
        "Imported lead — pending qualification by AI Intelligence.",
      intentSignals: [],
      website: row.website,
      status: "pending_analysis",
    };
    companies.push(company);

    // Determine stakeholders from this row.
    // If contactName provided, treat as the primary stakeholder.
    // Each linkedinUrl produces a separate stakeholder if no explicit contactName,
    // cycling through role steps so the 4-step sequence has a target.
    if (row.contactName) {
      stakeholders.push({
        id: `st_${companyId}_0`,
        companyId,
        name: row.contactName,
        title: row.contactTitle ?? "Decision Maker",
        role: deriveRole(0, row.contactRole),
        priority: "high",
        whyTarget:
          row.whyTarget ?? "Primary contact provided via import.",
        linkedinUrl: row.linkedinUrls[0],
        email: row.email,
      });
      // Additional URLs become extra stakeholders without explicit names.
      row.linkedinUrls.slice(1).forEach((url, i) => {
        stakeholders.push({
          id: `st_${companyId}_${i + 1}`,
          companyId,
          name: nameFromLinkedInUrl(url),
          title: "Contact",
          role: deriveRole(i + 1),
          priority: "medium",
          whyTarget: "Additional contact provided via import.",
          linkedinUrl: url,
        });
      });
    } else {
      row.linkedinUrls.forEach((url, i) => {
        stakeholders.push({
          id: `st_${companyId}_${i}`,
          companyId,
          name: nameFromLinkedInUrl(url),
          title: "Contact",
          role: deriveRole(i, i === 0 ? row.contactRole : undefined),
          priority: i === 0 ? "high" : "medium",
          whyTarget: "Imported contact.",
          linkedinUrl: url,
          email: i === 0 ? row.email : undefined,
        });
      });
      // No URLs but had email
      if (row.linkedinUrls.length === 0 && row.email) {
        stakeholders.push({
          id: `st_${companyId}_email`,
          companyId,
          name: row.contactName ?? row.email.split("@")[0],
          title: "Contact",
          role: deriveRole(0, row.contactRole),
          priority: "medium",
          whyTarget: "Email-only contact from import.",
          email: row.email,
        });
      }
    }
  }

  return { companies, stakeholders };
}
