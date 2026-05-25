import { PageHeader, PageBody } from "@/components/shell/PageShell";
import { DealPipeline } from "@/components/crm/DealPipeline";
import { NotifySalesPanel } from "@/components/crm/NotifySalesPanel";

export default function CRMPage() {
  return (
    <>
      <PageHeader
        layer={4}
        title="CRM Tracking (HubSpot)"
        description="Deal pipeline auto-synced from Layer 3. Updates flow in via MCP each time a campaign stage changes."
      />
      <PageBody className="space-y-6">
        <DealPipeline />
        <NotifySalesPanel />
      </PageBody>
    </>
  );
}
