import { requireAgency } from "@/lib/agency";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const { agency } = await requireAgency();

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Branding</h1>
      <p className="mt-1 text-muted">
        Your name, color and logo appear on every client&apos;s white-label
        dashboard — never SiteKeep&apos;s.
      </p>

      <div className="mt-8">
        <SettingsForm
          defaults={{
            name: agency.name,
            brand_color: agency.brand_color,
            logo_url: agency.logo_url,
          }}
        />
      </div>
    </div>
  );
}
