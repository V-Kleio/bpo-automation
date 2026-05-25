import { PageHeader, PageBody } from "@/components/shell/PageShell";
import { LeadTable } from "@/components/leads/LeadTable";

export default function LeadsPage() {
  return (
    <>
      <PageHeader
        layer={1}
        title="Lead Database"
        description="Raw leads gathered from Layer 1 (Smart Data Acquisition). Select rows and send them through the AI analysis engine."
      />
      <PageBody>
        <LeadTable />
      </PageBody>
    </>
  );
}
