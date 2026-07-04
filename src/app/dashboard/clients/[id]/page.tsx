import Link from "next/link";
import { Badge, Button, ButtonLink, Card } from "@/components/ui";
import { getClientWithServices } from "@/lib/clients";
import { getLatestSnapshots } from "@/lib/metrics";
import { SERVICE_TYPES, SERVICE_META } from "@/lib/services";
import { IncidentList, type IncidentEntry } from "@/components/metrics/MetricCards";
import { ServiceCard } from "@/components/metrics/ServiceCards";
import { HealthCard } from "@/components/metrics/HealthCard";
import { getClientHealth } from "@/lib/health-scores";
import { AnnotatedTrendCharts } from "@/components/metrics/AnnotatedTrendCharts";
import { AnnotationManager } from "./AnnotationManager";
import { getDatedTrendSeries, TREND_KEYS } from "@/lib/trends";
import { getAnnotations } from "@/lib/annotations";
import { createClient } from "@/lib/supabase/server";
import { getViewContext } from "@/lib/view-context";
import { ServiceToggles } from "./ServiceToggles";
import { TrafficSettings } from "./TrafficSettings";
import { getServiceAccount } from "@/lib/metrics/ga4";
import type { TrafficData } from "@/lib/metrics/types";
import { DeleteClientButton } from "./DeleteClientButton";
import { CopyLinkButton } from "./CopyLinkButton";
import { RefreshButton } from "./RefreshButton";
import { getSubscription, isEntitled } from "@/lib/billing";
import { ReportSettings } from "./ReportSettings";
import { RequestBoard } from "./RequestBoard";
import { ActivityLog } from "./ActivityLog";
import { startClientCheckoutAction, confirmActivateAction } from "../actions";
import type { ClientRequest } from "@/lib/requests";
import type { ActivityEntry } from "@/lib/activity";

// PageSpeed Insights can take 10–20s; give the refresh Server Action (which
// runs in this route's function) room beyond the default timeout.
export const maxDuration = 60;

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    gated?: string;
    subscribed?: string;
    checkout?: string;
    confirm?: string;
  }>;
}) {
  const { id } = await params;
  const { gated, subscribed, checkout, confirm } = await searchParams;
  const { client, services } = await getClientWithServices(id);
  const snapshots = await getLatestSnapshots(id);
  // Read-only when a super-admin is viewing this client through "view as agency".
  const { viewingAs } = await getViewContext();
  const readOnly = Boolean(viewingAs);

  const supabase = await createClient();
  const [
    { data: report },
    sub,
    { data: incidents },
    { data: requests },
    { data: activity },
    { data: trafficSvc },
  ] = await Promise.all([
    supabase
      .from("reports")
      .select("enabled, send_day, recipient_email, last_sent_at")
      .eq("client_id", id)
      .maybeSingle(),
    getSubscription(supabase, client.agency_id),
    supabase
      .from("incidents")
      .select("type, started_at, resolved_at, details")
      .eq("client_id", id)
      .order("started_at", { ascending: false })
      .limit(10),
    supabase
      .from("client_requests")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_log")
      .select("*")
      .eq("client_id", id)
      .order("performed_at", { ascending: false }),
    supabase
      .from("client_services")
      .select("config")
      .eq("client_id", id)
      .eq("service_type", "traffic")
      .maybeSingle(),
  ]);
  const entitled = isEntitled(sub?.status);

  const enabledServices = SERVICE_TYPES.filter((t) => services[t]);
  const health = await getClientHealth(supabase, id);

  const trends = await getDatedTrendSeries(supabase, id);
  const annotations = await getAnnotations(supabase, id);
  const trendKeys = TREND_KEYS.filter((k) => services[k]);

  // Traffic (GA4) settings state for the detail-page field.
  const ga4PropertyId =
    ((trafficSvc?.config as { ga4_property_id?: string | null } | null)
      ?.ga4_property_id ?? client.ga4_property_id) ?? null;
  const ga4ServiceEmail = getServiceAccount()?.client_email ?? null;
  const trafficConnected =
    Boolean(snapshots.traffic) &&
    (snapshots.traffic!.data as TrafficData).demo === false;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const publicUrl = `${siteUrl}/d/${client.slug}`;

  // Paused client prompts: subscribers confirm the $3/mo charge; everyone else
  // is routed to Checkout.
  const showConfirm = confirm === "1" && !client.is_active && entitled;
  const showGate =
    (gated === "1" || checkout === "cancel") && !client.is_active && !entitled;

  return (
    <div>
      <Link href="/dashboard" className="text-sm font-medium text-muted hover:text-ink">
        ← Clients
      </Link>

      {showConfirm && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-brand-100 bg-brand-50 px-5 py-4">
          <p className="text-sm text-ink">
            Activating this dashboard adds <strong>$3/month</strong> to your
            subscription, effective immediately.
          </p>
          <form action={confirmActivateAction.bind(null, id)}>
            <Button type="submit" size="sm">
              Confirm &amp; activate
            </Button>
          </form>
        </div>
      )}

      {showGate && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-brand-100 bg-brand-50 px-5 py-4">
          <p className="text-sm text-ink">
            This dashboard is <strong>paused</strong> — your first dashboard is
            free for 30 days; activating this one is $3/mo.
          </p>
          <form action={startClientCheckoutAction.bind(null, id)}>
            <Button type="submit" size="sm">
              Subscribe to activate
            </Button>
          </form>
        </div>
      )}

      {subscribed === "1" && client.is_active && (
        <div className="mt-4 rounded-[var(--radius-card)] border border-green-100 bg-fill-green px-5 py-4 text-sm text-accent-green">
          Payment received — this dashboard is now active.
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {client.company_name}
            </h1>
            {client.is_active ? (
              <Badge tone="green">Active</Badge>
            ) : (
              <Badge tone="neutral">Paused</Badge>
            )}
          </div>
          <a
            href={client.website_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-sm text-brand hover:underline"
          >
            {client.website_url}
          </a>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2">
            <ButtonLink href={`/dashboard/clients/${id}/edit`} variant="secondary" size="sm">
              Edit
            </ButtonLink>
            <DeleteClientButton clientId={id} clientName={client.company_name} />
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm font-medium text-muted">Monthly rate</p>
          <p className="mt-2 text-2xl font-bold text-ink">
            ${Number(client.monthly_rate).toFixed(0)}
            <span className="text-sm font-medium text-muted">/mo</span>
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-muted">Contact</p>
          <p className="mt-2 truncate text-sm text-ink">
            {client.contact_email ?? "—"}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-muted">Public dashboard</p>
          <div className="mt-2 flex items-center gap-2">
            <CopyLinkButton url={publicUrl} />
            <ButtonLink href={`/d/${client.slug}`} variant="ghost" size="sm">
              Open
            </ButtonLink>
          </div>
        </Card>
      </div>

      {/* Services */}
      <div className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">Services</h2>
        <p className="mt-1 text-sm text-muted">
          Toggle what appears on this client&apos;s dashboard. Changes save instantly.
        </p>
        <div className="mt-5">
          {readOnly ? (
            <div className="flex flex-wrap gap-2">
              {enabledServices.length === 0 ? (
                <span className="text-sm text-muted">No services enabled.</span>
              ) : (
                enabledServices.map((t) => (
                  <Badge key={t} tone="brand">
                    {SERVICE_META[t].label}
                  </Badge>
                ))
              )}
            </div>
          ) : (
            <ServiceToggles clientId={id} initial={services} />
          )}
        </div>
        {services.traffic && !readOnly && (
          <div className="mt-4">
            <TrafficSettings
              clientId={id}
              initialPropertyId={ga4PropertyId}
              serviceAccountEmail={ga4ServiceEmail}
              connected={trafficConnected}
            />
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Metrics</h2>
            <p className="mt-1 text-sm text-muted">
              Live data for the enabled services. This is what the client sees.
            </p>
          </div>
          {!readOnly && (
            <RefreshButton clientId={id} hasEnabled={enabledServices.length > 0} />
          )}
        </div>

        {enabledServices.length === 0 ? (
          <Card className="mt-5 p-6 text-sm text-muted">
            Enable a service above to start collecting metrics.
          </Card>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {enabledServices.map((type) => (
              <div
                key={type}
                className={
                  type === "page_speed" || type === "traffic" ? "lg:col-span-2" : ""
                }
              >
                <ServiceCard
                  type={type}
                  data={snapshots[type]?.data ?? null}
                  capturedAt={snapshots[type]?.captured_at}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composite health score */}
      {enabledServices.length > 0 && (
        <div className="mt-8">
          <HealthCard health={health} />
        </div>
      )}

      {/* Trends + annotations */}
      {trendKeys.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-bold tracking-tight">Trends</h2>
          <p className="mt-1 text-sm text-muted">
            History across refreshes. Charts appear once there are at least two
            data points.
          </p>
          <div className="mt-5">
            <AnnotatedTrendCharts
              series={trends}
              annotations={annotations}
              show={trendKeys}
            />
          </div>
          {!readOnly && (
            <AnnotationManager clientId={id} annotations={annotations} />
          )}
        </div>
      )}

      {/* Management — agency-only, clearly separated from the client-facing metrics.
          Hidden entirely in read-only "view as agency" support mode. */}
      {!readOnly && (
      <div className="mt-16 rounded-[var(--radius-card-lg)] border border-line bg-canvas-alt/60 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-xl font-bold tracking-tight">Management</h2>
          <span className="text-xs text-muted">
            Agency-only — none of this appears on the client dashboard
          </span>
        </div>

        <div className="mt-8 space-y-12">
          {/* Incident log (uptime service) */}
          {services.uptime && (
            <section>
              <h3 className="text-base font-bold text-ink">Incident log</h3>
              <p className="mt-1 text-sm text-muted">
                Downtime and SSL-expiry incidents detected by the uptime monitor.
              </p>
              <div className="mt-4">
                <IncidentList incidents={(incidents ?? []) as IncidentEntry[]} />
              </div>
            </section>
          )}

          {/* Activity log */}
          <section>
            <h3 className="text-base font-bold text-ink">What we did</h3>
            <p className="mt-1 text-sm text-muted">
              Log maintenance work here — it appears on the client&apos;s dashboard
              and in the monthly report. Some entries are added automatically.
            </p>
            <div className="mt-4">
              <ActivityLog clientId={id} initial={(activity ?? []) as ActivityEntry[]} />
            </div>
          </section>

          {/* Request board */}
          <section>
            <h3 className="text-base font-bold text-ink">Requests</h3>
            <p className="mt-1 text-sm text-muted">
              Change requests submitted from this client&apos;s dashboard. Move them
              along as you work.
            </p>
            <div className="mt-4">
              <RequestBoard clientId={id} initial={(requests ?? []) as ClientRequest[]} />
            </div>
          </section>

          {/* Monthly report */}
          <section>
            <h3 className="text-base font-bold text-ink">Monthly report</h3>
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
        </div>
      </div>
      )}
    </div>
  );
}
