import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { type ServiceType } from "@/lib/services";
import { ServiceMetricBlock } from "@/components/metrics/MetricCards";

// NOTE: minimal public view so Phase 2 links resolve. Phase 4 fully white-labels
// this (agency logo + brand_color, live metrics, last-updated, agency footer).

type PublicDashboard = {
  client: { company_name: string; website_url: string; logo_url: string | null };
  agency: { name: string; logo_url: string | null; brand_color: string };
  services: ServiceType[];
  metrics: Partial<Record<ServiceType, unknown>>;
};

export default async function PublicDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_dashboard", {
    dashboard_slug: slug,
  });

  if (!data) notFound();
  const dash = data as PublicDashboard;

  return (
    <main className="bg-wash min-h-screen">
      <div className="mx-auto max-w-4xl px-6 py-14">
        <header className="text-center">
          <p className="text-sm font-medium text-muted">{dash.agency.name}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {dash.client.company_name}
          </h1>
          <a
            href={dash.client.website_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-sm text-brand hover:underline"
          >
            {dash.client.website_url}
          </a>
        </header>

        <div className="mt-10 space-y-8">
          {dash.services.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted">
              No services are enabled for this dashboard yet.
            </Card>
          ) : (
            dash.services.map((type) => (
              <ServiceMetricBlock
                key={type}
                type={type}
                data={dash.metrics[type] ?? null}
              />
            ))
          )}
        </div>

        <footer className="mt-12 text-center text-xs text-muted">
          Maintained by {dash.agency.name}
        </footer>
      </div>
    </main>
  );
}
