import { redirect } from "next/navigation";
import { getClientWithServices } from "@/lib/clients";
import { getViewContext } from "@/lib/view-context";
import { createClient } from "@/lib/supabase/server";
import { IncidentList, type IncidentEntry } from "@/components/metrics/MetricCards";
import { RequestBoard } from "../RequestBoard";
import { ActivityLog } from "../ActivityLog";
import type { ClientRequest } from "@/lib/requests";
import type { ActivityEntry } from "@/lib/activity";

// Manage tab — agency-only operations that never appear on the client dashboard:
// maintenance activity, change requests, and the uptime incident log.
export default async function ClientManageTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { services } = await getClientWithServices(id);
  const { viewingAs } = await getViewContext();
  if (viewingAs) redirect(`/dashboard/clients/${id}`); // read-only support view

  const supabase = await createClient();
  const [{ data: incidents }, { data: requests }, { data: activity }] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-12">
      <section>
        <h2 className="text-xl font-bold tracking-tight">What we did</h2>
        <p className="mt-1 text-sm text-muted">
          Log maintenance work here — it appears on the client&apos;s dashboard and
          in the monthly report. Some entries are added automatically.
        </p>
        <div className="mt-4">
          <ActivityLog clientId={id} initial={(activity ?? []) as ActivityEntry[]} />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold tracking-tight">Requests</h2>
        <p className="mt-1 text-sm text-muted">
          Change requests submitted from this client&apos;s dashboard. Move them
          along as you work.
        </p>
        <div className="mt-4">
          <RequestBoard clientId={id} initial={(requests ?? []) as ClientRequest[]} />
        </div>
      </section>

      {services.uptime && (
        <section>
          <h2 className="text-xl font-bold tracking-tight">Incident log</h2>
          <p className="mt-1 text-sm text-muted">
            Downtime and SSL-expiry incidents detected by the uptime monitor.
          </p>
          <div className="mt-4">
            <IncidentList incidents={(incidents ?? []) as IncidentEntry[]} />
          </div>
        </section>
      )}
    </div>
  );
}
