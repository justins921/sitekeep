import { StatCard } from "@/components/ui";
import {
  requireSuperAdmin,
  getAdminOverview,
  listAdminAgencies,
  recentSubscriptionEvents,
  type SubscriptionEvent,
} from "@/lib/admin";
import { HealthGrid } from "./HealthGrid";

export const dynamic = "force-dynamic";

function money(n: number): string {
  return `$${n.toLocaleString()}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d > 0) return `${d}d ago`;
  const h = Math.floor(diff / 3_600_000);
  if (h > 0) return `${h}h ago`;
  const m = Math.floor(diff / 60_000);
  return m > 0 ? `${m}m ago` : "just now";
}

const SUB_TONE: Record<string, string> = {
  active: "text-accent-green",
  trialing: "text-brand",
  past_due: "text-accent-orange",
  unpaid: "text-accent-magenta",
  canceled: "text-muted",
  inactive: "text-muted",
};

export default async function AdminOverviewPage() {
  const { supabase } = await requireSuperAdmin();
  const [overview, agencies, subEvents] = await Promise.all([
    getAdminOverview(supabase),
    listAdminAgencies(supabase),
    recentSubscriptionEvents(supabase, 10),
  ]);

  const o = overview ?? {
    mrr: 0,
    total_agencies: 0,
    active_dashboards: 0,
    trial_agencies: 0,
    failed_payments: 0,
    conversion_rate: 0,
  };

  const recentSignups = agencies.slice(0, 20);

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform overview</h1>
        <p className="mt-1 text-muted">Everything across every agency, in one place.</p>
      </div>

      {/* Overview cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="MRR" value={money(o.mrr)} accent="text-brand" />
        <StatCard label="Agencies" value={o.total_agencies} />
        <StatCard label="Active dashboards" value={o.active_dashboards} />
        <StatCard label="Trial / free" value={o.trial_agencies} />
        <StatCard
          label="Conversion"
          value={`${o.conversion_rate}%`}
          accent={o.conversion_rate > 0 ? "text-accent-green" : "text-ink"}
        />
        <StatCard
          label="Failed payments"
          value={o.failed_payments}
          accent={o.failed_payments > 0 ? "text-accent-magenta" : "text-ink"}
        />
      </div>

      {/* Recent activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[var(--radius-card-lg)] border border-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-bold tracking-tight">Recent signups</h2>
          <p className="mt-1 text-sm text-muted">Newest agencies to join.</p>
          <ul className="mt-4 divide-y divide-line">
            {recentSignups.length === 0 && (
              <li className="py-3 text-sm text-muted">No agencies yet.</li>
            )}
            {recentSignups.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{a.name}</p>
                  <p className="truncate text-xs text-muted">{a.owner_email ?? "—"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-xs font-medium ${SUB_TONE[a.status] ?? "text-muted"}`}>
                    {a.status}
                  </p>
                  <p className="text-xs text-muted">{timeAgo(a.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[var(--radius-card-lg)] border border-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-bold tracking-tight">Subscription events</h2>
          <p className="mt-1 text-sm text-muted">Latest billing changes.</p>
          <ul className="mt-4 divide-y divide-line">
            {subEvents.length === 0 && (
              <li className="py-3 text-sm text-muted">No subscription activity yet.</li>
            )}
            {subEvents.map((e: SubscriptionEvent, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {e.agency_name ?? "—"}
                  </p>
                  <p className={`text-xs font-medium ${SUB_TONE[e.status] ?? "text-muted"}`}>
                    {e.status} · {e.quantity} seat{e.quantity === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted">{timeAgo(e.updated_at)}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Red/Yellow/Green grid */}
      <section>
        <h2 className="text-lg font-bold tracking-tight">Client health</h2>
        <p className="mt-1 text-sm text-muted">
          Every client dashboard across the platform, color-coded by health score.
        </p>
        <div className="mt-5">
          <HealthGrid agencies={agencies} />
        </div>
      </section>
    </div>
  );
}
