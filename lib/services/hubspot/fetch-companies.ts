import "server-only";
import { getHubSpotClient } from "./client";
import { hubspotRecordToCompany } from "./to-companies";
import type { Company } from "@/lib/types";

const PROPERTIES = [
  "name",
  "industry",
  "numberofemployees",
  "city",
  "country",
  "website",
  "description",
  "lifecyclestage",
];

export interface FetchCompaniesResult {
  configured: boolean;
  companies: Company[];
  error?: string;
}

export async function fetchHubSpotCompanies(
  limit = 100,
): Promise<FetchCompaniesResult> {
  const client = getHubSpotClient();
  if (!client) {
    return { configured: false, companies: [] };
  }
  try {
    const page = await client.crm.companies.basicApi.getPage(
      Math.min(100, Math.max(1, limit)),
      undefined,
      PROPERTIES,
    );
    const companies = (page.results ?? []).map(hubspotRecordToCompany);
    return { configured: true, companies };
  } catch (err) {
    return {
      configured: true,
      companies: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
