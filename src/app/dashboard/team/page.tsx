import { requireAgency } from "@/lib/agency";
import { createClient } from "@/lib/supabase/server";
import { getTeamRoster } from "@/lib/team";
import { TeamManager } from "./TeamManager";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  await requireAgency(); // redirects to /login or /join if no membership
  const supabase = await createClient();
  const roster = await getTeamRoster(supabase);

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Team</h1>
      <p className="mt-1 text-muted">
        Everyone who can manage this agency&apos;s clients and reports.
      </p>
      <div className="mt-8">
        {roster ? (
          <TeamManager roster={roster} />
        ) : (
          <p className="text-sm text-muted">Could not load your team.</p>
        )}
      </div>
    </div>
  );
}
