import { redirect } from "next/navigation";
import { Card, ButtonLink } from "@/components/ui";
import { getClientWithServices } from "@/lib/clients";
import { getLatestSnapshots } from "@/lib/metrics";
import { getViewContext } from "@/lib/view-context";
import { createClient } from "@/lib/supabase/server";
import { getServiceAccount } from "@/lib/metrics/ga4";
import type { SearchConsoleData, TrafficData } from "@/lib/metrics/types";
import { ServiceToggles } from "../ServiceToggles";
import { TrafficSettings } from "../TrafficSettings";
import { SearchConsoleSettings } from "../SearchConsoleSettings";
import { GoogleBusinessSettings } from "../GoogleBusinessSettings";
import { AiVisibilitySettings } from "../AiVisibilitySettings";
import { ReportSettings } from "../ReportSettings";
import { gbpConfigured } from "@/lib/metrics/google-business";
import { CopyLinkButton } from "../CopyLinkButton";
import { DeleteClientButton } from "../DeleteClientButton";
import { ClientForm } from "../../ClientForm";
import { updateClientAction } from "../../actions";

export default async function ClientSettingsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { client, services } = await getClientWithServices(id);
  const { viewingAs } = await getViewContext();
  if (viewingAs) redirect(`/dashboard/clients/${id}`); // settings are not read-only-safe

  const supabase = await createClient();
  const snapshots = await getLatestSnapshots(id);
  const [{ data: report }, { data: trafficSvc }, { data: gscSvc }, { data: gbpSvc }] = await Promise.all([
    supabase
      .from("reports")
      .select("enabled, send_day, recipient_email, last_sent_at")
      .eq("client_id", id)
      .maybeSingle(),
    supabase
      .from("client_services")
      .select("config")
      .eq("client_id", id)
      .eq("service_type", "traffic")
      .maybeSingle(),
    supabase
      .from("client_services")
      .select("config")
      .eq("client_id", id)
      .eq("service_type", "search_console")
      .maybeSingle(),
    supabase
      .from("client_services")
      .select("config")
      .eq("client_id", id)
      .eq("service_type", "google_business")
      .maybeSingle(),
  ]);

  const ga4PropertyId =
    ((trafficSvc?.config as { ga4_property_id?: string | null } | null)?.ga4_property_id ??
      client.ga4_property_id) ?? null;
  const ga4ServiceEmail = getServiceAccount()?.client_email ?? null;
  const trafficConnected =
    Boolean(snapshots.traffic) && (snapshots.traffic!.data as TrafficData).demo === false;
  const gscSiteUrl =
    ((gscSvc?.config as { gsc_site_url?: string | null } | null)?.gsc_site_url) ?? null;
  const gscData = snapshots.search_console?.data as SearchConsoleData | undefined;
  const gscConnected = gscData?.connected === true;
  const gscError = gscData && !gscData.connected ? gscData.error ?? null : null;

  // AI Visibility (Clicks) config: this client's project id + the agency's
  // connection status (mode only — the credential is never read back to the UI).
  const [{ data: clicksRow }, { data: clicksConn }] = await Promise.all([
    supabase.from("clients").select("clicks_project_id").eq("id", id).maybeSingle(),
    supabase
      .from("agency_clicks_connections")
      .select("auth_mode")
      .eq("agency_id", client.agency_id)
      .maybeSingle(),
  ]);
  const clicksProjectId = (clicksRow?.clicks_project_id as number | null) ?? null;
  const clicksMode = (clicksConn?.auth_mode as "session" | "token" | undefined) ?? null;

  const gbpConfig = (gbpSvc?.config as { place_id?: string | null; place_name?: string | null } | null) ?? null;
  const gbpPlaceName = gbpConfig?.place_name ?? null;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const publicUrl = `${siteUrl}/d/${client.slug}`;

  return (
    <div className="space-y-12">
      {/* Services */}
      <section>
        <h2 className="text-xl font-bold tracking-tight">Services</h2>
        <p className="mt-1 text-sm text-muted">
          Toggle what appears on this client&apos;s dashboard. Changes save instantly.
        </p>
        <div className="mt-5">
          <ServiceToggles clientId={id} initial={services} />
        </div>
        {services.traffic && (
          <div className="mt-4">
            <TrafficSettings
              clientId={id}
              initialPropertyId={ga4PropertyId}
              serviceAccountEmail={ga4ServiceEmail}
              connected={trafficConnected}
            />
          </div>
        )}
        {services.search_console && (
          <div className="mt-4">
            <SearchConsoleSettings
              clientId={id}
              initialSiteUrl={gscSiteUrl}
              serviceAccountEmail={ga4ServiceEmail}
              connected={gscConnected}
              connectionError={gscError}
            />
          </div>
        )}
        {services.google_business && (
          <div className="mt-4">
            <GoogleBusinessSettings
              clientId={id}
              initialQuery={gbpPlaceName ?? ""}
              placeName={gbpPlaceName}
              keyConfigured={gbpConfigured()}
            />
          </div>
        )}
        <div className="mt-4">
          <AiVisibilitySettings
            clientId={id}
            initialProjectId={clicksProjectId}
            connectionMode={clicksMode}
            connected={Boolean(clicksMode)}
          />
        </div>
      </section>

      {/* Monthly report */}
      <section>
        <h2 className="text-xl font-bold tracking-tight">Monthly report</h2>
        <p className="mt-1 text-sm text-muted">
          Automatically email this dashboard to the client each month.
        </p>
        <Card className="mt-4 p-6">
          <ReportSettings
            clientId={id}
            defaults={{
              enabled: report?.enabled ?? false,
              send_day: report?.send_day ?? 1,
              recipient_email: report?.recipient_email ?? client.contact_email,
              last_sent_at: report?.last_sent_at ?? null,
            }}
          />
        </Card>
      </section>

      {/* Public dashboard link */}
      <section>
        <h2 className="text-xl font-bold tracking-tight">Public dashboard</h2>
        <p className="mt-1 text-sm text-muted">
          The white-label link you share with the client.
        </p>
        <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 p-5">
          <code className="min-w-0 truncate text-sm text-body">{publicUrl}</code>
          <div className="flex items-center gap-2">
            <CopyLinkButton url={publicUrl} />
            <ButtonLink href={`/d/${client.slug}`} variant="ghost" size="sm">
              Open
            </ButtonLink>
          </div>
        </Card>
      </section>

      {/* Client details */}
      <section>
        <h2 className="text-xl font-bold tracking-tight">Client details</h2>
        <p className="mt-1 text-sm text-muted">
          Name, website, contact, rate, and whether the dashboard is active.
        </p>
        <Card className="mt-4 p-6 sm:p-8">
          <ClientForm
            action={updateClientAction.bind(null, id)}
            submitLabel="Save changes"
            showActive
            defaults={{
              company_name: client.company_name,
              website_url: client.website_url,
              contact_email: client.contact_email,
              monthly_rate: client.monthly_rate,
              is_active: client.is_active,
            }}
          />
        </Card>
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="text-xl font-bold tracking-tight text-accent-magenta">Danger zone</h2>
        <p className="mt-1 text-sm text-muted">
          Deleting a client removes its dashboard, metrics, and public link. This
          can&apos;t be undone.
        </p>
        <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 border-pink-100 p-5">
          <div>
            <p className="text-sm font-semibold text-ink">Delete this client</p>
            <p className="text-sm text-muted">{client.company_name}</p>
          </div>
          <DeleteClientButton clientId={id} clientName={client.company_name} />
        </Card>
      </section>
    </div>
  );
}
