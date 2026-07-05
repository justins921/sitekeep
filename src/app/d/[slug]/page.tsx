import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { type ServiceType } from "@/lib/services";
import { IncidentList, type IncidentEntry } from "@/components/metrics/MetricCards";
import { ServiceCard } from "@/components/metrics/ServiceCards";
import { HealthCard } from "@/components/metrics/HealthCard";
import type { HealthSnapshot } from "@/lib/health-scores";
import { AnnotatedTrendCharts } from "@/components/metrics/AnnotatedTrendCharts";
import { TREND_KEYS, datedFromRpc, type TrendKey, type TrendSeries } from "@/lib/trends";
import { categoryMeta, type PublicAnnotation } from "@/lib/annotations";
import { timeAgo } from "@/components/metrics/format";
import { normalizeHex, readableText, safeAccent, withAlpha } from "@/lib/color";
import { RequestChangeForm } from "./RequestChangeForm";

type PublicDashboard = {
  client: { company_name: string; website_url: string; logo_url: string | null };
  agency: { name: string; logo_url: string | null; brand_color: string; contact_email: string | null };
  services: ServiceType[];
  health: HealthSnapshot | null;
  metrics: Partial<Record<ServiceType, unknown>>;
  updated: Partial<Record<ServiceType, string>>;
  incidents: IncidentEntry[];
  activity: {
    title: string;
    description: string | null;
    category: string | null;
    performed_at: string;
  }[];
  trends: TrendSeries;
  trend_dates?: Partial<Record<TrendKey, string[]>>;
  annotations: PublicAnnotation[];
};

async function loadDashboard(slug: string): Promise<PublicDashboard | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_dashboard", {
    dashboard_slug: slug,
  });
  return (data as PublicDashboard) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dash = await loadDashboard(slug);
  if (!dash) return { title: "Dashboard" };
  // White-label: title reflects the agency + client, never SiteKeep.
  return {
    title: `${dash.client.company_name} — ${dash.agency.name}`,
    robots: { index: false },
  };
}

export default async function PublicDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dash = await loadDashboard(slug);
  if (!dash) notFound();

  const brand = normalizeHex(dash.agency.brand_color);
  const onBrand = readableText(brand);
  const accent = safeAccent(brand);

  const mostRecent = Object.values(dash.updated ?? {}).sort().at(-1);

  return (
    <main className="min-h-screen bg-canvas" style={{ ["--brand" as string]: brand }}>
      {/* Branded header band */}
      <header style={{ backgroundColor: brand, color: onBrand }}>
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-6">
          {dash.agency.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dash.agency.logo_url}
              alt={dash.agency.name}
              className="h-10 w-10 rounded-lg bg-white/90 object-contain p-1"
            />
          ) : (
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-base font-bold"
              style={{ color: onBrand }}
            >
              {dash.agency.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="text-sm font-semibold tracking-tight opacity-95">
            {dash.agency.name}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* Client identity */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              {dash.client.company_name}
            </h1>
            <a
              href={dash.client.website_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-sm font-medium hover:underline"
              style={{ color: accent }}
            >
              {dash.client.website_url}
            </a>
          </div>
          {mostRecent && (
            <span className="text-xs text-muted">
              Last updated {timeAgo(mostRecent)}
            </span>
          )}
        </div>

        {/* Health score hero — leads the dashboard */}
        {dash.health && dash.health.score !== null && (
          <div className="mt-6">
            <HealthCard health={dash.health} />
          </div>
        )}

        {/* Metrics per enabled service — premium multi-column card grid */}
        <div className="mt-8">
          {dash.services.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted">
              This dashboard is being set up. Check back soon.
            </Card>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {dash.services.map((type) => (
                <div
                  key={type}
                  className={
                    type === "page_speed" || type === "traffic" || type === "search_console"
                      ? "lg:col-span-2"
                      : ""
                  }
                >
                  <ServiceCard
                    type={type}
                    data={dash.metrics[type] ?? null}
                    capturedAt={dash.updated?.[type]}
                    accentColor={accent}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trends */}
        {(() => {
          const show = TREND_KEYS.filter((k) => dash.services.includes(k));
          if (show.length === 0) return null;
          return (
            <div
              className="mt-10 border-t-2 pt-6"
              style={{ borderColor: withAlpha(brand, 0.25) }}
            >
              <h3 className="text-lg font-bold text-ink" style={{ color: accent }}>
                Trends
              </h3>
              <div className="mt-4">
                <AnnotatedTrendCharts
                  series={datedFromRpc(dash.trends, dash.trend_dates)}
                  annotations={dash.annotations ?? []}
                  show={show}
                  accentColor={accent}
                />
              </div>
              {(dash.annotations ?? []).length > 0 && (
                <ul className="mt-5 space-y-2">
                  {dash.annotations.map((a, i) => {
                    const meta = categoryMeta(a.category);
                    return (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        <span
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                          style={{ color: meta.color, backgroundColor: `${meta.color}1a` }}
                          aria-hidden
                        >
                          {meta.icon}
                        </span>
                        <span>
                          <span className="font-semibold text-ink">{a.label}</span>
                          {a.description && (
                            <span className="text-body"> — {a.description}</span>
                          )}
                          <span className="text-muted">
                            {" "}
                            ·{" "}
                            {new Date(`${a.annotation_date}T12:00:00`).toLocaleDateString(
                              undefined,
                              { year: "numeric", month: "short", day: "numeric" },
                            )}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })()}

        {/* What we've done (activity log) */}
        {dash.activity.length > 0 && (
          <div
            className="mt-10 border-t-2 pt-6"
            style={{ borderColor: withAlpha(brand, 0.25) }}
          >
            <h3 className="text-lg font-bold text-ink" style={{ color: accent }}>
              What we&apos;ve done
            </h3>
            <ul className="mt-4 space-y-4">
              {dash.activity.map((a, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-ink">{a.title}</p>
                    {a.description && (
                      <p className="mt-0.5 text-sm text-body">{a.description}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted">
                      {new Date(a.performed_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Incident history (uptime service) */}
        {dash.services.includes("uptime") && dash.incidents.length > 0 && (
          <div
            className="mt-10 border-t-2 pt-6"
            style={{ borderColor: withAlpha(brand, 0.25) }}
          >
            <h3 className="text-lg font-bold text-ink" style={{ color: accent }}>
              Recent incidents
            </h3>
            <div className="mt-3">
              <IncidentList incidents={dash.incidents} />
            </div>
          </div>
        )}

        {/* Request a change */}
        <div
          id="request"
          className="mt-10 scroll-mt-6 border-t-2 pt-6"
          style={{ borderColor: withAlpha(brand, 0.25) }}
        >
          <h3 className="text-lg font-bold text-ink" style={{ color: accent }}>
            Request a change
          </h3>
          <p className="mt-1 text-sm text-muted">
            Need something updated? Send it straight to the team maintaining this site.
          </p>
          <div className="mt-4">
            <RequestChangeForm slug={slug} accent={accent} />
          </div>
        </div>

        {/* Agency footer — fully white-label, no SiteKeep branding */}
        <footer className="mt-14 border-t border-line pt-6 text-center">
          <p className="text-sm font-semibold text-ink">Maintained by {dash.agency.name}</p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted">
            {dash.agency.contact_email && (
              <a
                href={`mailto:${dash.agency.contact_email}`}
                className="hover:underline"
                style={{ color: accent }}
              >
                {dash.agency.contact_email}
              </a>
            )}
            {dash.agency.contact_email && <span className="text-faint">·</span>}
            <a href="#request" className="hover:underline" style={{ color: accent }}>
              Report an issue
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
