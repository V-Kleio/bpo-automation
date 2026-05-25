import type { Company, Tier } from "@/lib/types";

interface HubSpotCompanyProperties {
  name?: string;
  industry?: string;
  numberofemployees?: string;
  city?: string;
  country?: string;
  website?: string;
  description?: string;
  lifecyclestage?: string;
}

interface HubSpotCompanyRecord {
  id: string;
  properties: HubSpotCompanyProperties;
}

function tierFromLifecycle(stage?: string): Tier {
  switch ((stage ?? "").toLowerCase()) {
    case "customer":
    case "evangelist":
    case "opportunity":
      return "priority";
    case "salesqualifiedlead":
    case "marketingqualifiedlead":
      return "warm";
    default:
      return "nurture";
  }
}

export function hubspotRecordToCompany(rec: HubSpotCompanyRecord): Company {
  const p = rec.properties;
  const headcount = Number(p.numberofemployees ?? "0") || 0;
  const hq = [p.city, p.country].filter(Boolean).join(", ") || "Unknown";
  const industry = p.industry
    ? p.industry.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
    : ["Unknown"];

  return {
    id: `co_hs_${rec.id}`,
    name: p.name ?? "Untitled company",
    industry,
    size: headcount
      ? `${headcount.toLocaleString()} employees`
      : "Size unknown",
    headcount,
    hq,
    tier: tierFromLifecycle(p.lifecyclestage),
    whyTarget:
      p.description ??
      "Pulled from HubSpot — pending qualification by AI Intelligence.",
    intentSignals: [],
    website: p.website,
    status: "pending_analysis",
  };
}
