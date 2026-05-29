import { PageHeader, PageBody } from "@/components/shell/PageShell";
import { KanbanBoard } from "@/components/campaigns/KanbanBoard";
import { LinkedInConnectButton } from "@/components/campaigns/LinkedInConnectButton";
import { LinkedInQueuePanel } from "@/components/campaigns/LinkedInQueuePanel";
import { ProviderBadge } from "@/components/campaigns/ProviderBadge";

export default function CampaignsPage() {
  return (
    <>
      <PageHeader
        layer={3}
        title="Campaign & Outreach Manager"
        description="LinkedIn-only outreach through the 4-step stakeholder sequence: Champion → Economic Buyer → Technical Gatekeeper → CEO. Email is not yet supported."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LinkedInConnectButton />
          </div>
        }
      />
      <PageBody>
        <div className="mb-3">
          <ProviderBadge />
        </div>
        <LinkedInQueuePanel />
        <KanbanBoard />
      </PageBody>
    </>
  );
}
