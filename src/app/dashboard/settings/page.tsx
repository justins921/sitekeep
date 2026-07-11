import { requireAgency } from "@/lib/agency";
import { SettingsForm } from "./SettingsForm";
import { RecapSettings } from "./RecapSettings";

export default async function SettingsPage() {
  const { agency, userEmail } = await requireAgency();

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Branding</h1>
      <p className="mt-1 text-muted">
        Your name, color and logo appear on every client&apos;s white-label
        dashboard — never SiteKeep&apos;s.
      </p>

      <div className="mt-8">
        <SettingsForm
          ownerEmail={userEmail}
          defaults={{
            name: agency.name,
            brand_color: agency.brand_color,
            logo_url: agency.logo_url,
            alert_email: agency.alert_email,
          }}
        />
      </div>

      <div className="mt-8">
        <RecapSettings enabled={agency.weekly_recap_enabled} />
      </div>
    </div>
  );
}
