import { NextResponse } from "next/server";
import {
  applySettings,
  isEditableKey,
  readCurrentSettings,
  SettingsValidationError,
  type EnvKey,
} from "@/lib/services/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readCurrentSettings());
}

export async function PUT(request: Request) {
  let body: { updates?: unknown };
  try {
    body = (await request.json()) as { updates?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (
    !body.updates ||
    typeof body.updates !== "object" ||
    Array.isArray(body.updates)
  ) {
    return NextResponse.json(
      { error: "Body must be { updates: { KEY: value | null } }" },
      { status: 400 },
    );
  }

  // The registry is the allowlist — reject anything else outright.
  const updates: Partial<Record<EnvKey, string | null>> = {};
  for (const [key, value] of Object.entries(body.updates)) {
    if (!isEditableKey(key)) {
      return NextResponse.json(
        { error: `Unknown or non-editable setting: ${key}` },
        { status: 400 },
      );
    }
    if (value !== null && typeof value !== "string") {
      return NextResponse.json(
        { error: `Value for ${key} must be a string or null` },
        { status: 400 },
      );
    }
    updates[key] = value;
  }

  try {
    const { view } = applySettings(updates);
    return NextResponse.json(view);
  } catch (err) {
    if (err instanceof SettingsValidationError) {
      return NextResponse.json(
        { error: err.message, fieldErrors: err.fieldErrors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
