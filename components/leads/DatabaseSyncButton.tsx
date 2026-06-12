"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Database, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { getClientConfig } from "@/lib/services/public-config-client";
import type { Company, Stakeholder } from "@/lib/types";

interface DbLeadsResponse {
  configured: boolean;
  companies: Company[];
  stakeholders: Stakeholder[];
  fetched: number;
  error?: string;
}

export function DatabaseSyncButton() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const addCompanies = useStore((s) => s.addCompanies);
  const addStakeholders = useStore((s) => s.addStakeholders);
  const log = useStore((s) => s.log);

  useEffect(() => {
    getClientConfig()
      .then((cfg) => setAvailable(cfg.db.configured))
      .catch(() => setAvailable(false));
  }, []);

  async function sync() {
    setBusy(true);
    try {
      const res = await fetch("/api/db/leads", { cache: "no-store" });
      const data = (await res.json()) as DbLeadsResponse;
      if (!data.configured) {
        toast.info("MySQL database not configured — nothing to sync.");
        setAvailable(false);
        return;
      }
      if (data.error) {
        toast.error("Database sync failed", { description: data.error });
        return;
      }
      const companiesAdded = addCompanies(data.companies);
      const stakeholdersAdded = addStakeholders(data.stakeholders);
      log({
        layer: 1,
        type: "crm_sync",
        summary: `Pulled ${data.fetched} rows from MySQL — ${companiesAdded} new compan${companiesAdded === 1 ? "y" : "ies"}, ${stakeholdersAdded} new contact${stakeholdersAdded === 1 ? "" : "s"}.`,
        meta: {
          source: "mysql",
          fetched: data.fetched,
          companiesAdded,
          stakeholdersAdded,
        },
      });
      toast.success(
        `${companiesAdded} compan${companiesAdded === 1 ? "y" : "ies"}, ${stakeholdersAdded} contact${stakeholdersAdded === 1 ? "" : "s"} synced from MySQL`,
        {
          description: `${data.fetched} rows read from database.`,
        },
      );
    } catch (err) {
      toast.error("Database sync failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  }

  if (available !== true) return null;

  return (
    <Button variant="outline" size="md" onClick={sync} disabled={busy}>
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Database className="h-4 w-4" />
      )}
      Sync MySQL
    </Button>
  );
}
