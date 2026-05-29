import "server-only";
import { getHubSpotClient } from "./client";
import {
  hubspotContactsToCompanies,
  type HubSpotContactRecord,
} from "./to-stakeholders";
import type { Company, Stakeholder } from "@/lib/types";

// HubSpot contact properties to pull. Keep this list aligned with what your
// portal actually has — HubSpot returns 400 for unknown property names.
// `company` is the grouping key for Company records; `hs_linkedin_url`
// (HubSpot-enriched) and `linkedin` (custom) are both checked when building
// the Stakeholder.
const PROPERTIES = [
  "firstname",
  "lastname",
  "email",
  "jobtitle",
  "company",
  "hs_linkedin_url",
  "linkedin",
];

export interface FetchContactsResult {
  configured: boolean;
  companies: Company[];
  stakeholders: Stakeholder[];
  fetched: number;
  skippedNoCompany: number;
  error?: string;
}

export async function fetchHubSpotContacts(
  limit = 100,
): Promise<FetchContactsResult> {
  const client = getHubSpotClient();
  if (!client) {
    return {
      configured: false,
      companies: [],
      stakeholders: [],
      fetched: 0,
      skippedNoCompany: 0,
    };
  }
  try {
    const page = await client.crm.contacts.basicApi.getPage(
      Math.min(100, Math.max(1, limit)),
      undefined,
      PROPERTIES,
    );
    const records = (page.results ?? []) as unknown as HubSpotContactRecord[];
    const { companies, stakeholders, skipped } =
      hubspotContactsToCompanies(records);
    return {
      configured: true,
      companies,
      stakeholders,
      fetched: records.length,
      skippedNoCompany: skipped,
    };
  } catch (err) {
    return {
      configured: true,
      companies: [],
      stakeholders: [],
      fetched: 0,
      skippedNoCompany: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
