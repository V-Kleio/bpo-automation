import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/services/linkedin/queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getSnapshot());
}
