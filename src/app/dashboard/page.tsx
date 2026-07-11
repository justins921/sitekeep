import { ButtonLink, Card, Spark } from "@/components/ui";
import { listClients } from "@/lib/clients";
import { getViewContext } from "@/lib/view-context";
import { getSitesOverview } from "@/lib/keep-score/overview";
import { SiteCard } from "@/components/keep-score/SiteCard";

export default async function DashboardHome() {
  const [clients, { supabase, viewingAs }] = await Promise.all([
    listClients(),
    getViewContext(),
  ]);
  const hasClients = clients.length > 0;
  const readOnly = Boolean(viewingAs);
  const overviews = await getSitesOverview(
    supabase,
    clients.map((c) => c.id),
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sites</h1>
          <p className="mt-1 text-muted">
            Every site you keep healthy — one Keep Score each.
          </p>
        </div>
        {!readOnly && <ButtonLink href="/dashboard/clients/new">Add site</ButtonLink>}
      </div>

      <div className="mt-8">
        {!hasClients ? (
          <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
              <Spark className="h-7 w-7 text-brand" />
            </span>
            <h2 className="mt-5 text-xl font-bold tracking-tight">Add your first site</h2>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Start monitoring a client site and SiteKeep gives it a Keep Score, a green-week
              grid, and a client-ready weekly recap.
            </p>
            {!readOnly && (
              <div className="mt-6">
                <ButtonLink href="/dashboard/clients/new">Start monitoring a site</ButtonLink>
              </div>
            )}
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c) => {
              const overview = overviews.get(c.id) ?? {
                weeks: [],
                keepScore: null,
                status: "none" as const,
                streak: { chainWeeks: 0, previousBest: 0, brokeRecently: false },
                incidentFreeDays: null,
              };
              return <SiteCard key={c.id} client={c} overview={overview} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
