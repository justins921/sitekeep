import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { type ServiceType } from "@/lib/services";
import { ServiceMetricBlock } from "@/components/metrics/MetricCards";
import { timeAgo } from "@/components/metrics/format";
import { normalizeHex, readableText, safeAccent, withAlpha } from "@/lib/color";

type PublicDashboard = {
  client: { company_name: string; website_url: string; logo_url: string | null };
  agency: { name: string; logo_url: string | null; brand_color: string };
  services: ServiceType[];
  metrics: Partial<Record<ServiceType, unknown>>;
  updated: Partial<Record<ServiceType, string>>;
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

        {/* Metrics per enabled service */}
        <div className="mt-10 space-y-10">
          {dash.services.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted">
              This dashboard is being set up. Check back soon.
            </Card>
          ) : (
            dash.services.map((type) => (
              <div
                key={type}
                className="border-t-2 pt-6"
                style={{ borderColor: withAlpha(brand, 0.25) }}
              >
                <ServiceMetricBlock
                  type={type}
                  data={dash.metrics[type] ?? null}
                  capturedAt={dash.updated?.[type]}
                  accentColor={accent}
                />
              </div>
            ))
          )}
        </div>

        {/* Agency footer — no SiteKeep branding */}
        <footer className="mt-14 border-t border-line pt-6 text-center">
          <p className="text-sm font-medium text-ink">
            Maintained by {dash.agency.name}
          </p>
        </footer>
      </div>
    </main>
  );
}
