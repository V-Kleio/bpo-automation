import Papa from "papaparse";
import { coerceImportRow, validateRow } from "./validators";
import type { ParsedImport, ImportRow, RowValidationError } from "./types";

export function parseCsv(input: string | File): Promise<ParsedImport> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(input as File, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        const rows: ImportRow[] = [];
        const errors: RowValidationError[] = [];
        results.data.forEach((raw, idx) => {
          const row = coerceImportRow(raw);
          const rowErrors = validateRow(row, idx + 1);
          if (rowErrors.length > 0) {
            errors.push(...rowErrors);
            return;
          }
          rows.push(row);
        });
        resolve({ rows, errors, totalRows: results.data.length });
      },
      error: (err) => reject(err),
    });
  });
}
