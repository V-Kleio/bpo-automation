import type { Tier } from "@/lib/types";

export interface ImportRow {
  companyName: string;
  linkedinUrls: string[];
  email?: string;
  contactName?: string;
  contactTitle?: string;
  contactRole?: string;
  tier?: Tier;
  industry?: string[];
  hq?: string;
  headcount?: number;
  website?: string;
  whyTarget?: string;
}

export interface RowValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ParsedImport {
  rows: ImportRow[];
  errors: RowValidationError[];
  totalRows: number;
}

export interface ImportResult {
  companiesAdded: number;
  stakeholdersAdded: number;
  skipped: number;
}
