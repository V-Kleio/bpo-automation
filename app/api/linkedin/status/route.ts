import { NextResponse } from "next/server";
import { selectAdapter } from "@/lib/services/linkedin";
import { getUsage } from "@/lib/services/linkedin/rate-limiter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { adapter, provider, reason } = selectAdapter();
  const authenticated = await adapter.isAuthenticated();
  const configured = await adapter.isConfigured();
  const usage = getUsage();

  return NextResponse.json({
    provider,
    configured,
    authenticated,
    reason,
    dailyUsage: usage.used,
    dailyCap: usage.cap,
  });
}
