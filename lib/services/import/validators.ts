import type { ImportRow, RowValidationError } from "./types";
import type { StakeholderRole, Tier } from "@/lib/types";

const VALID_TIERS: ReadonlyArray<Tier> = ["priority", "warm", "nurture"];
const VALID_ROLES: ReadonlyArray<StakeholderRole> = [
  "champion",
  "economic_buyer",
  "technical_gatekeeper",
  "ceo",
];

const URL_RE = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w\-_%.]+\/?(\?.*)?$/i;

export function validateRow(
  row: ImportRow,
  rowIndex: number,
): RowValidationError[] {
  const errors: RowValidationError[] = [];

  if (!row.companyName || !row.companyName.trim()) {
    errors.push({
      row: rowIndex,
      field: "companyName",
      message: "Company name is required.",
    });
  }

  const hasUrl = row.linkedinUrls.length > 0;
  const hasEmail = !!row.email && row.email.trim().length > 0;
  if (!hasUrl && !hasEmail) {
    errors.push({
      row: rowIndex,
      field: "linkedinUrls|email",
      message:
        "Each row must include at least one LinkedIn URL or an email address.",
    });
  }

  for (const url of row.linkedinUrls) {
    if (!URL_RE.test(url)) {
      errors.push({
        row: rowIndex,
        field: "linkedinUrls",
        message: `"${url}" is not a recognized LinkedIn profile URL.`,
      });
    }
  }

  if (row.tier && !VALID_TIERS.includes(row.tier)) {
    errors.push({
      row: rowIndex,
      field: "tier",
      message: `Tier must be one of: ${VALID_TIERS.join(", ")}.`,
    });
  }

  if (
    row.contactRole &&
    !VALID_ROLES.includes(row.contactRole as StakeholderRole)
  ) {
    errors.push({
      row: rowIndex,
      field: "contactRole",
      message: `Role must be one of: ${VALID_ROLES.join(", ")}.`,
    });
  }

  return errors;
}

export function normalizeHeader(s: string): string {
  return s
    .replace(/[\s_-]+/g, "")
    .replace(/[^\w]/g, "")
    .toLowerCase();
}

const HEADER_ALIASES: Record<string, keyof ImportRow> = {
  companyname: "companyName",
  company: "companyName",
  name: "companyName",
  linkedinurls: "linkedinUrls",
  linkedinurl: "linkedinUrls",
  linkedin: "linkedinUrls",
  linkedinprofile: "linkedinUrls",
  linkedinprofiles: "linkedinUrls",
  email: "email",
  emailaddress: "email",
  contactname: "contactName",
  fullname: "contactName",
  contacttitle: "contactTitle",
  title: "contactTitle",
  contactrole: "contactRole",
  role: "contactRole",
  tier: "tier",
  priority: "tier",
  industry: "industry",
  industries: "industry",
  hq: "hq",
  headquarters: "hq",
  location: "hq",
  city: "hq",
  headcount: "headcount",
  employees: "headcount",
  size: "headcount",
  website: "website",
  url: "website",
  whytarget: "whyTarget",
  notes: "whyTarget",
};

export function mapHeaderToField(header: string): keyof ImportRow | null {
  const key = normalizeHeader(header);
  return HEADER_ALIASES[key] ?? null;
}

export function splitMultiValue(raw: string): string[] {
  return raw
    .split(/[;|]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function coerceImportRow(
  raw: Record<string, string>,
): ImportRow {
  const row: ImportRow = {
    companyName: "",
    linkedinUrls: [],
  };
  for (const [k, v] of Object.entries(raw)) {
    const field = mapHeaderToField(k);
    if (!field) continue;
    const value = (v ?? "").toString().trim();
    if (!value) continue;
    switch (field) {
      case "linkedinUrls":
        row.linkedinUrls = splitMultiValue(value);
        break;
      case "industry":
        row.industry = splitMultiValue(value);
        break;
      case "headcount": {
        const n = parseInt(value.replace(/[^0-9]/g, ""), 10);
        if (!Number.isNaN(n)) row.headcount = n;
        break;
      }
      case "tier":
        row.tier = value.toLowerCase() as Tier;
        break;
      case "contactRole":
        row.contactRole = value.toLowerCase().replace(/[\s-]+/g, "_");
        break;
      default:
        (row as unknown as Record<string, unknown>)[field] = value;
    }
  }
  return row;
}
