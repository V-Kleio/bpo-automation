import { PageHeader, PageBody } from "@/components/shell/PageShell";
import { EventLogFeed } from "@/components/logs/EventLogFeed";
import {
  FunnelChart,
  ChannelPerformanceChart,
  LayerActivityPie,
} from "@/components/logs/Charts";

export default function LogsPage() {
  return (
    <>
      <PageHeader
        title="Logs & Analytics"
        description="Real-time event feed and conversion analytics across all layers."
      />
      <PageBody className="space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <FunnelChart />
          <ChannelPerformanceChart />
          <LayerActivityPie />
        </div>
        <EventLogFeed />
      </PageBody>
    </>
  );
}
