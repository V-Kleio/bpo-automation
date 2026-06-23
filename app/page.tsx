import { PageHeader, PageBody } from "@/components/shell/PageShell";
import { LayerHero } from "@/components/overview/LayerHero";
import { QuickActions } from "@/components/overview/QuickActions";
import { FunnelChart, LayerActivityPie } from "@/components/logs/Charts";
import { EventLogFeed } from "@/components/logs/EventLogFeed";

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="End-to-end view of the AI-assisted outreach workflow — Layer 1 raw data through Layer 4 CRM handover."
      />
      <PageBody className="space-y-6">
        <LayerHero />
        <QuickActions />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <FunnelChart />
          <LayerActivityPie />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold text-fg">
            Recent Activity
          </h2>
          <EventLogFeed limit={10} />
        </div>
      </PageBody>
    </>
  );
}
