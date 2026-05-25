import { parseCsv } from "./csv-parser";
import { parseXlsx } from "./xlsx-parser";
import { importRowsToCompanies } from "./to-companies";
import type { ParsedImport, ImportResult } from "./types";

export async function parseFile(file: File): Promise<ParsedImport> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return parseXlsx(file);
  }
  return parseCsv(file);
}

export { parseCsv, parseXlsx, importRowsToCompanies };
export type { ParsedImport, ImportResult };
export type { ImportRow, RowValidationError } from "./types";
