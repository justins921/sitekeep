import Link from "next/link";
import { Badge, Button, ButtonLink, Card } from "@/components/ui";
import { getClientWithServices } from "@/lib/clients";
import { getLatestSnapshots } from "@/lib/metrics";
import { SERVICE_TYPES } from "@/lib/services";
import { ServiceMetricBlock } from "@/components/metrics/MetricCards";
import { createClient } from "@/lib/supabase/server";
import { ServiceToggles } from "./ServiceToggles";
import { DeleteClientButton } from "./DeleteClientButton";
import { CopyLinkButton } from "./CopyLinkButton";
import { RefreshButton } from "./RefreshButton";
import { getSubscription, isEntitled } from "@/lib/billing";
import { ReportSettings } from "./ReportSettings";
import { startClientCheckoutAction, confirmActivateAction } from "../actions";

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

  const supabase = await createClient();
  const [{ data: report }, sub] = await Promise.all([
    supabase
      .from("reports")
      .select("enabled, send_day, recipient_email, last_sent_at")
      .eq("client_id", id)
      .maybeSingle(),
    getSubscription(supabase, client.agency_id),
  ]);
  const entitled = isEntitled(sub?.status);

  const enabledServices = SERVICE_TYPES.filter((t) => services[t]);

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

        <div className="flex items-center gap-2">
          <ButtonLink href={`/dashboard/clients/${id}/edit`} variant="secondary" size="sm">
            Edit
          </ButtonLink>
          <DeleteClientButton clientId={id} clientName={client.company_name} />
        </div>
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
          <ServiceToggles clientId={id} initial={services} />
        </div>
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
          <RefreshButton clientId={id} hasEnabled={enabledServices.length > 0} />
        </div>

        {enabledServices.length === 0 ? (
          <Card className="mt-5 p-6 text-sm text-muted">
            Enable a service above to start collecting metrics.
          </Card>
        ) : (
          <div className="mt-5 space-y-8">
            {enabledServices.map((type) => (
              <ServiceMetricBlock
                key={type}
                type={type}
                data={snapshots[type]?.data ?? null}
                capturedAt={snapshots[type]?.captured_at}
              />
            ))}
          </div>
        )}
      </div>

      {/* Monthly report */}
      <div className="mt-12">
        <h2 className="text-xl font-bold tracking-tight">Monthly report</h2>
        <p className="mt-1 text-sm text-muted">
          Automatically email this dashboard to the client each month.
        </p>
        <Card className="mt-5 p-6">
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
      </div>
    </div>
  );
}
