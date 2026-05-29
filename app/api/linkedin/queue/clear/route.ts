import { NextResponse } from "next/server";
import {
  clearAll,
  clearFinished,
  getSnapshot,
} from "@/lib/services/linkedin/queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "finished";
  const removed = scope === "all" ? clearAll() : clearFinished();
  return NextResponse.json({ removed, snapshot: getSnapshot() });
}
