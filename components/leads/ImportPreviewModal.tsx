"use client";
import { useMemo } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Upload, AlertTriangle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import type { ParsedImport } from "@/lib/services/import";

export function ImportPreviewModal({
  open,
  onClose,
  parsed,
  fileName,
  onConfirm,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  parsed: ParsedImport | null;
  fileName: string | null;
  onConfirm: () => void;
  busy: boolean;
}) {
  const valid = parsed?.rows ?? [];
  const errors = parsed?.errors ?? [];
  const previewRows = useMemo(() => valid.slice(0, 10), [valid]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Import Leads
        </span>
      }
      description={
        fileName
          ? `Reviewing ${fileName}. Confirm to add validated rows to the lead database.`
          : "Upload a CSV or XLSX file to bring new leads into the database."
      }
      width="max-w-3xl"
    >
      <div className="p-6 space-y-5">
        {parsed && (
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              label="Rows in file"
              value={parsed.totalRows}
              tone="neutral"
            />
            <StatCard
              label="Valid"
              value={valid.length}
              tone="success"
            />
            <StatCard
              label="With errors"
              value={errors.length}
              tone={errors.length > 0 ? "warn" : "neutral"}
            />
          </div>
        )}

        {errors.length > 0 && (
          <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              {errors.length} row{errors.length === 1 ? "" : "s"} skipped
            </div>
            <ul className="mt-2 space-y-1 text-xs text-amber-900">
              {errors.slice(0, 8).map((e, i) => (
                <li key={i}>
                  Row {e.row} — <span className="font-medium">{e.field}</span>:{" "}
                  {e.message}
                </li>
              ))}
              {errors.length > 8 && (
                <li className="italic text-amber-800">
                  …and {errors.length - 8} more.
                </li>
              )}
            </ul>
          </div>
        )}

        {valid.length > 0 && (
          <div className="overflow-hidden rounded-md border border-border">
            <div className="border-b border-border bg-surface-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
              Preview · first {previewRows.length} valid row
              {previewRows.length === 1 ? "" : "s"}
            </div>
            <table className="w-full text-xs">
              <thead className="bg-surface-2 text-fg-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Company</th>
                  <th className="px-2 py-1.5 text-left font-medium">Contact</th>
                  <th className="px-2 py-1.5 text-left font-medium">LinkedIn</th>
                  <th className="px-2 py-1.5 text-left font-medium">Email</th>
                  <th className="px-2 py-1.5 text-left font-medium">Tier</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1.5 font-medium text-fg">
                      {r.companyName}
                    </td>
                    <td className="px-2 py-1.5 text-fg">
                      {r.contactName ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-fg-muted truncate max-w-[200px]">
                      {r.linkedinUrls.length > 0
                        ? `${r.linkedinUrls[0]}${r.linkedinUrls.length > 1 ? ` (+${r.linkedinUrls.length - 1})` : ""}`
                        : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-fg-muted truncate max-w-[150px]">
                      {r.email ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-fg">
                      {r.tier ?? "warm"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {parsed && valid.length === 0 && errors.length === 0 && (
          <div className="rounded-md border border-dashed border-border-strong bg-surface p-6 text-center text-sm text-fg-muted">
            File contained no data rows.
          </div>
        )}

        {!parsed && (
          <div className="rounded-md border border-dashed border-border-strong bg-surface p-6 text-center text-sm text-fg-muted">
            Parsing file…
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border pt-4">
          <a
            href="/sample/sample-linkedin-targets.csv"
            download
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Download sample CSV
          </a>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="accent"
              size="md"
              onClick={onConfirm}
              disabled={busy || valid.length === 0}
            >
              <Upload className="h-4 w-4" />
              {busy
                ? "Importing…"
                : `Import ${valid.length} lead${valid.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "warn";
}) {
  const cls =
    tone === "success"
      ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
      : tone === "warn"
        ? "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
        : "border-border bg-surface-2 text-fg";
  return (
    <div className={`rounded-md border px-3 py-2 ${cls}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
        {label}
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-lg font-semibold">
        {tone === "success" && value > 0 && (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        {value}
      </div>
    </div>
  );
}
