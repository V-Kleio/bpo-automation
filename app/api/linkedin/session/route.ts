import { NextResponse } from "next/server";
import { clearSavedSession } from "@/lib/services/linkedin/session-store";
import { resetAdapterCache } from "@/lib/services/linkedin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE() {
  clearSavedSession();
  resetAdapterCache();
  return NextResponse.json({ cleared: true });
}
