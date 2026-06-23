import { Suspense } from "react";
import { PageHeader } from "@/components/shell/PageShell";
import { IntelligenceWorkbench } from "@/components/intelligence/IntelligenceWorkbench";

export default function IntelligencePage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        layer={2}
        title="Centralized AI Intelligence"
        description="Claude analyzes the selected company, qualifies the lead, and drafts a per-stakeholder outreach sequence."
      />
      <div className="flex-1 min-h-0">
        <Suspense fallback={<div className="p-6 text-sm text-fg-muted">Loading workbench…</div>}>
          <IntelligenceWorkbench />
        </Suspense>
      </div>
    </div>
  );
}
