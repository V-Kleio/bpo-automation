import { NextResponse } from "next/server";
import { fetchHubSpotContacts } from "@/lib/services/hubspot/fetch-contacts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "100");
  const result = await fetchHubSpotContacts(limit);
  if (!result.configured) {
    return NextResponse.json({
      configured: false,
      companies: [],
      stakeholders: [],
      fetched: 0,
      skippedNoCompany: 0,
    });
  }
  if (result.error) {
    return NextResponse.json(
      {
        configured: true,
        companies: [],
        stakeholders: [],
        fetched: 0,
        skippedNoCompany: 0,
        error: result.error,
      },
      { status: 502 },
    );
  }
  return NextResponse.json({
    configured: true,
    companies: result.companies,
    stakeholders: result.stakeholders,
    fetched: result.fetched,
    skippedNoCompany: result.skippedNoCompany,
  });
}
