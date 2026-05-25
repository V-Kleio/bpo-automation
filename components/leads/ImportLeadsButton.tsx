"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { parseFile, importRowsToCompanies } from "@/lib/services/import";
import type { ParsedImport } from "@/lib/services/import";
import { ImportPreviewModal } from "./ImportPreviewModal";

export function ImportLeadsButton() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const addCompanies = useStore((s) => s.addCompanies);
  const addStakeholders = useStore((s) => s.addStakeholders);
  const log = useStore((s) => s.log);

  function pick() {
    fileInputRef.current?.click();
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setOpen(true);
    setParsed(null);
    try {
      const result = await parseFile(file);
      setParsed(result);
    } catch (err) {
      toast.error("Failed to parse file", {
        description: err instanceof Error ? err.message : String(err),
      });
      setOpen(false);
    } finally {
      // allow re-uploading the same file
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function confirmImport() {
    if (!parsed || parsed.rows.length === 0) return;
    setBusy(true);
    try {
      const { companies, stakeholders } = importRowsToCompanies(parsed.rows);
      const companiesAdded = addCompanies(companies);
      const stakeholdersAdded = addStakeholders(stakeholders);

      log({
        layer: 1,
        type: "user_action",
        summary: `Imported ${companiesAdded} company / ${stakeholdersAdded} stakeholder records from ${fileName ?? "file"}.`,
        meta: { source: "csv_xlsx_upload" },
      });

      toast.success(
        `Imported ${companiesAdded} compan${companiesAdded === 1 ? "y" : "ies"}`,
        {
          description:
            stakeholdersAdded > 0
              ? `${stakeholdersAdded} stakeholder${stakeholdersAdded === 1 ? "" : "s"} added.`
              : undefined,
        },
      );
      setOpen(false);
      setParsed(null);
      setFileName(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={onFileSelected}
      />
      <Button
        variant="outline"
        size="md"
        onClick={pick}
        title="Import leads from CSV or XLSX"
      >
        <FileUp className="h-4 w-4" />
        Import
      </Button>
      <ImportPreviewModal
        open={open}
        onClose={() => {
          if (!busy) {
            setOpen(false);
            setParsed(null);
            setFileName(null);
          }
        }}
        parsed={parsed}
        fileName={fileName}
        onConfirm={confirmImport}
        busy={busy}
      />
    </>
  );
}
