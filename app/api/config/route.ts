import { NextResponse } from "next/server";
import { getPublicFlags } from "@/lib/services/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getPublicFlags());
}
