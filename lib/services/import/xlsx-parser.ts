import { coerceImportRow, validateRow } from "./validators";
import type { ParsedImport, ImportRow, RowValidationError } from "./types";

export async function parseXlsx(file: File): Promise<ParsedImport> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  if (!firstSheet) {
    return { rows: [], errors: [], totalRows: 0 };
  }
  const raw = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, {
    defval: "",
    raw: false,
  });

  const rows: ImportRow[] = [];
  const errors: RowValidationError[] = [];
  raw.forEach((entry, idx) => {
    const row = coerceImportRow(entry);
    const rowErrors = validateRow(row, idx + 1);
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }
    rows.push(row);
  });
  return { rows, errors, totalRows: raw.length };
}
