"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Cloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { getClientConfig } from "@/lib/services/public-config-client";
import type { Company, Stakeholder } from "@/lib/types";

interface HubspotContactsResponse {
  configured: boolean;
  companies: Company[];
  stakeholders: Stakeholder[];
  fetched: number;
  skippedNoCompany: number;
  error?: string;
}

export function HubSpotSyncButton() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const addCompanies = useStore((s) => s.addCompanies);
  const addStakeholders = useStore((s) => s.addStakeholders);
  const log = useStore((s) => s.log);

  useEffect(() => {
    getClientConfig()
      .then((cfg) => setAvailable(cfg.hubspot.configured))
      .catch(() => setAvailable(false));
  }, []);

  async function sync() {
    setBusy(true);
    try {
      const res = await fetch("/api/hubspot/contacts?limit=100", {
        cache: "no-store",
      });
      const data = (await res.json()) as HubspotContactsResponse;
      if (!data.configured) {
        toast.info("HubSpot not configured — nothing to sync.");
        setAvailable(false);
        return;
      }
      if (data.error) {
        toast.error("HubSpot sync failed", { description: data.error });
        return;
      }
      const companiesAdded = addCompanies(data.companies);
      const stakeholdersAdded = addStakeholders(data.stakeholders);
      log({
        layer: 1,
        type: "crm_sync",
        summary: `Pulled ${data.fetched} contacts from HubSpot — ${companiesAdded} new compan${companiesAdded === 1 ? "y" : "ies"}, ${stakeholdersAdded} new contact${stakeholdersAdded === 1 ? "" : "s"}.`,
        meta: {
          source: "hubspot",
          fetched: data.fetched,
          companiesAdded,
          stakeholdersAdded,
          skippedNoCompany: data.skippedNoCompany,
        },
      });
      const skippedNote =
        data.skippedNoCompany > 0
          ? `${data.skippedNoCompany} contact${data.skippedNoCompany === 1 ? "" : "s"} skipped (no company name).`
          : undefined;
      toast.success(
        `${companiesAdded} compan${companiesAdded === 1 ? "y" : "ies"}, ${stakeholdersAdded} contact${stakeholdersAdded === 1 ? "" : "s"} synced from HubSpot`,
        {
          description: skippedNote,
        },
      );
    } catch (err) {
      toast.error("HubSpot sync failed", {
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
        <Cloud className="h-4 w-4" />
      )}
      Sync HubSpot
    </Button>
  );
}
