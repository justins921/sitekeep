import Link from "next/link";
import { Badge, ButtonLink, Card, Spark } from "@/components/ui";
import { listClients } from "@/lib/clients";
import { getViewContext } from "@/lib/view-context";

export default async function DashboardHome() {
  const [clients, { viewingAs }] = await Promise.all([
    listClients(),
    getViewContext(),
  ]);
  const hasClients = clients.length > 0;
  const readOnly = Boolean(viewingAs);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="mt-1 text-muted">
            Every client you keep on a maintenance retainer.
          </p>
        </div>
        {!readOnly && (
          <ButtonLink href="/dashboard/clients/new">+ Add client</ButtonLink>
        )}
      </div>

      <div className="mt-8">
        {!hasClients ? (
          <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
              <Spark className="h-7 w-7 text-brand" />
            </span>
            <h2 className="mt-5 text-xl font-bold tracking-tight">No clients yet</h2>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Add your first client to generate a branded dashboard and start
              turning maintenance into recurring revenue.
            </p>
            {!readOnly && (
              <div className="mt-6">
                <ButtonLink href="/dashboard/clients/new">
                  Add your first client
                </ButtonLink>
              </div>
            )}
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c) => (
              <Card key={c.id} hover className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/dashboard/clients/${c.id}`}
                    className="min-w-0 flex-1"
                  >
                    <h3 className="truncate font-bold text-ink">{c.company_name}</h3>
                    <p className="mt-1 truncate text-sm text-muted">
                      {c.website_url}
                    </p>
                  </Link>
                  {c.is_active ? (
                    <Badge tone="green">Active</Badge>
                  ) : (
                    <Badge tone="neutral">Paused</Badge>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                  <span className="text-sm font-medium text-brand">
                    ${Number(c.monthly_rate).toFixed(0)}/mo
                  </span>
                  <a
                    href={`/d/${c.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-muted hover:text-brand"
                  >
                    View dashboard →
                  </a>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
