import { NextResponse } from "next/server";
import { fetchHubSpotCompanies } from "@/lib/services/hubspot/fetch-companies";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const result = await fetchHubSpotCompanies(limit);
  if (!result.configured) {
    return NextResponse.json({ configured: false, companies: [] });
  }
  if (result.error) {
    return NextResponse.json(
      { configured: true, companies: [], error: result.error },
      { status: 502 },
    );
  }
  return NextResponse.json({
    configured: true,
    companies: result.companies,
  });
}
