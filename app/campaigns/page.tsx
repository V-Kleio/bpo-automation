import { PageHeader, PageBody } from "@/components/shell/PageShell";
import { KanbanBoard } from "@/components/campaigns/KanbanBoard";
import { SimulateClockToggle } from "@/components/campaigns/SimulateClockToggle";

export default function CampaignsPage() {
  return (
    <>
      <PageHeader
        layer={3}
        title="Campaign & Outreach Manager"
        description="Multi-channel outreach orchestrated through the 4-step stakeholder sequence: Champion → Economic Buyer → Technical Gatekeeper → CEO."
        actions={<SimulateClockToggle />}
      />
      <PageBody>
        <KanbanBoard />
      </PageBody>
    </>
  );
}
