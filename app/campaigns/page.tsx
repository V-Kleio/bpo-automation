import { PageHeader, PageBody } from "@/components/shell/PageShell";
import { KanbanBoard } from "@/components/campaigns/KanbanBoard";
import { SimulateClockToggle } from "@/components/campaigns/SimulateClockToggle";
import { LinkedInConnectButton } from "@/components/campaigns/LinkedInConnectButton";
import { ProviderBadge } from "@/components/campaigns/ProviderBadge";

export default function CampaignsPage() {
  return (
    <>
      <PageHeader
        layer={3}
        title="Campaign & Outreach Manager"
        description="Multi-channel outreach orchestrated through the 4-step stakeholder sequence: Champion → Economic Buyer → Technical Gatekeeper → CEO."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LinkedInConnectButton />
            <SimulateClockToggle />
          </div>
        }
      />
      <PageBody>
        <div className="mb-3">
          <ProviderBadge />
        </div>
        <KanbanBoard />
      </PageBody>
    </>
  );
}
