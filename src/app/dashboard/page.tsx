import Link from "next/link";
import { requireAgency } from "@/lib/agency";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink, Card, Spark } from "@/components/ui";

export default async function DashboardHome() {
  const { agency } = await requireAgency();
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, company_name, website_url, slug, is_active, monthly_rate")
    .order("created_at", { ascending: false });

  const hasClients = (clients?.length ?? 0) > 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="mt-1 text-muted">
            Every client you keep on a maintenance retainer.
          </p>
        </div>
        <ButtonLink href="/dashboard/clients/new">+ Add client</ButtonLink>
      </div>

      <div className="mt-8">
        {!hasClients ? (
          <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
              <Spark className="h-7 w-7 text-brand" />
            </span>
            <h2 className="mt-5 text-xl font-bold tracking-tight">
              No clients yet
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Add your first client to generate a branded dashboard and start
              turning maintenance into recurring revenue.
            </p>
            <div className="mt-6">
              <ButtonLink href="/dashboard/clients/new">
                Add your first client
              </ButtonLink>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients!.map((c) => (
              <Link key={c.id} href={`/dashboard/clients/${c.id}`} className="block">
                <Card hover className="p-5">
                  <h3 className="font-bold text-ink">{c.company_name}</h3>
                  <p className="mt-1 truncate text-sm text-muted">
                    {c.website_url}
                  </p>
                  <p className="mt-4 text-sm font-medium text-brand">
                    ${Number(c.monthly_rate).toFixed(0)}/mo
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Agency context is available for future header personalization. */}
      <span className="sr-only">{agency.name}</span>
    </div>
  );
}
