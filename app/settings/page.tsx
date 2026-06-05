import { PageHeader, PageBody } from "@/components/shell/PageShell";
import { SettingsForm } from "@/components/settings/SettingsForm";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Provider credentials, models, and LinkedIn pacing. Saves are written to .env.local and applied immediately."
      />
      <PageBody>
        <SettingsForm />
      </PageBody>
    </>
  );
}
