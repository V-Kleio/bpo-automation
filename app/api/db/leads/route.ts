import { NextResponse } from "next/server";
import { getServerConfig } from "@/lib/services/config";
import { getDbPool } from "@/lib/services/db/client";
import { uid } from "@/lib/utils";
import type { Company, Stakeholder } from "@/lib/types";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Rows returned from the MySQL leads table. Column names are mapped
// case-insensitively; any unknown columns are ignored.
interface LeadRow {
  id?: string | number;
  company_name?: string;
  company?: string;
  name?: string;
  industry?: string;
  size?: string;
  headcount?: string | number;
  hq?: string;
  location?: string;
  website?: string;
  why_target?: string;
  contact_name?: string;
  contact_title?: string;
  title?: string;
  role?: string;
  linkedin_url?: string;
  email?: string;
}

function normalize(row: Record<string, unknown>): LeadRow {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.toLowerCase()] = v;
  }
  return out as LeadRow;
}

function deriveCompany(row: LeadRow): Omit<Company, "id"> {
  const name =
    row.company_name ?? row.company ?? row.name ?? "Unknown Company";
  const headcountRaw = row.headcount;
  const headcount = headcountRaw ? Number(headcountRaw) : 0;
  return {
    name: String(name),
    industry: row.industry ? [String(row.industry)] : [],
    size: row.size ?? (headcount > 0 ? `${headcount}` : "Unknown"),
    headcount: isNaN(headcount) ? 0 : headcount,
    hq: String(row.hq ?? row.location ?? ""),
    tier: "nurture" as const,
    whyTarget: String(row.why_target ?? ""),
    intentSignals: [],
    website: row.website ? String(row.website) : undefined,
    status: "pending_analysis" as const,
  };
}

function deriveStakeholder(
  row: LeadRow,
  companyId: string,
): Omit<Stakeholder, "id"> | null {
  const contactName = row.contact_name ?? row.name;
  if (!contactName) return null;
  return {
    companyId,
    name: String(contactName),
    title: String(row.contact_title ?? row.title ?? ""),
    role: "champion" as const,
    priority: "medium" as const,
    whyTarget: "",
    linkedinUrl: row.linkedin_url ? String(row.linkedin_url) : undefined,
    email: row.email ? String(row.email) : undefined,
  };
}

export async function GET() {
  const cfg = getServerConfig();
  if (!cfg.db.configured) {
    return NextResponse.json(
      { configured: false, companies: [], stakeholders: [], fetched: 0 },
      { status: 200 },
    );
  }

  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json(
      { configured: false, companies: [], stakeholders: [], fetched: 0 },
      { status: 200 },
    );
  }

  let rows: Record<string, unknown>[];
  try {
    // Query the first available table that looks like a leads/contacts table.
    // Prioritise common table names; fall back to the first table in the DB.
    const [tables] = await pool.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
      [cfg.db.name],
    );
    const PREFERRED = ["leads", "contacts", "companies", "prospects", "targets"];
    const tableNames = (tables as Array<Record<string, string>>).map(
      (t) => Object.values(t)[0] as string,
    );
    const table =
      tableNames.find((t) => PREFERRED.includes(t.toLowerCase())) ??
      tableNames[0];

    if (!table) {
      return NextResponse.json(
        {
          configured: true,
          companies: [],
          stakeholders: [],
          fetched: 0,
          error: "No tables found in the database.",
        },
        { status: 200 },
      );
    }

    const [result] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM \`${table}\` LIMIT 500`,
    );
    rows = result as Record<string, unknown>[];
  } catch (err) {
    return NextResponse.json(
      {
        configured: true,
        companies: [],
        stakeholders: [],
        fetched: 0,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  // Group rows by company name. Each unique company becomes one Company
  // record; each row can contribute one Stakeholder.
  const companyMap = new Map<string, { company: Company; seenRows: Set<string> }>();
  const stakeholders: Stakeholder[] = [];

  for (const rawRow of rows) {
    const row = normalize(rawRow);
    const derived = deriveCompany(row);
    const key = derived.name.toLowerCase().trim();

    if (!companyMap.has(key)) {
      companyMap.set(key, {
        company: { id: uid("db"), ...derived },
        seenRows: new Set(),
      });
    }
    const { company } = companyMap.get(key)!;
    const sh = deriveStakeholder(row, company.id);
    if (sh) {
      const shKey = `${sh.name}|${sh.title}`;
      const entry = companyMap.get(key)!;
      if (!entry.seenRows.has(shKey)) {
        entry.seenRows.add(shKey);
        stakeholders.push({ id: uid("db-sh"), ...sh });
      }
    }
  }

  const companies = Array.from(companyMap.values()).map((e) => e.company);
  return NextResponse.json({
    configured: true,
    companies,
    stakeholders,
    fetched: rows.length,
  });
}
