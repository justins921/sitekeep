import { requireSuperAdmin, listAdminAgencies } from "@/lib/admin";
import { AgencyTable } from "../AgencyTable";

export const dynamic = "force-dynamic";

export default async function AdminAgenciesPage() {
  const { supabase } = await requireSuperAdmin();
  const agencies = await listAdminAgencies(supabase);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agencies</h1>
        <p className="mt-1 text-muted">
          Every agency on the platform. Click a row for its clients, or view a
          dashboard exactly as the agency sees it.
        </p>
      </div>
      <AgencyTable agencies={agencies} />
    </div>
  );
}
