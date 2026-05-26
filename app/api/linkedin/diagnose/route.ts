import { NextResponse } from "next/server";
import { diagnoseProfile } from "@/lib/services/linkedin/adapter-playwright";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/linkedin/diagnose?url=https://www.linkedin.com/in/someone/
//
// Useful when a real send fails. Reports the final URL after redirects,
// the profile heading (if found), and the visible buttons so we can see
// exactly what the headless browser is looking at. Always saves a
// screenshot to .data/linkedin/screenshots/.

export async function GET(request: Request) {
  const url = new URL(request.url);
  const profileUrl = url.searchParams.get("url");
  if (!profileUrl) {
    return NextResponse.json(
      { error: "url query param is required" },
      { status: 400 },
    );
  }
  try {
    const result = await diagnoseProfile(profileUrl);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
