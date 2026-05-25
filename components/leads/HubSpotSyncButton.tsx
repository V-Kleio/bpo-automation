"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Cloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { getClientConfig } from "@/lib/services/public-config-client";
import type { Company } from "@/lib/types";

interface HubspotCompaniesResponse {
  configured: boolean;
  companies: Company[];
  error?: string;
}

export function HubSpotSyncButton() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const addCompanies = useStore((s) => s.addCompanies);
  const log = useStore((s) => s.log);

  useEffect(() => {
    getClientConfig()
      .then((cfg) => setAvailable(cfg.hubspot.configured))
      .catch(() => setAvailable(false));
  }, []);

  async function sync() {
    setBusy(true);
    try {
      const res = await fetch("/api/hubspot/companies?limit=100", {
        cache: "no-store",
      });
      const data = (await res.json()) as HubspotCompaniesResponse;
      if (!data.configured) {
        toast.info("HubSpot not configured — nothing to sync.");
        setAvailable(false);
        return;
      }
      if (data.error) {
        toast.error("HubSpot sync failed", { description: data.error });
        return;
      }
      const added = addCompanies(data.companies);
      log({
        layer: 1,
        type: "crm_sync",
        summary: `Pulled ${data.companies.length} companies from HubSpot — ${added} new.`,
        meta: { source: "hubspot", fetched: data.companies.length, added },
      });
      toast.success(
        `${added} new compan${added === 1 ? "y" : "ies"} synced from HubSpot`,
        {
          description:
            data.companies.length - added > 0
              ? `${data.companies.length - added} already in the database.`
              : undefined,
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
