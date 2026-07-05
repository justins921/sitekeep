import { requireSuperAdmin, listAdminAgencies } from "@/lib/admin";
import { listFeatureFlags, listAgencyFlagOverrides } from "@/lib/features";
import { FlagsBoard, type BoardAgency, type BoardFlag } from "./FlagsBoard";

// Feature-flag console. The layout already gates on requireSuperAdmin(); we call
// it again to get the RLS client and enforce authorization at the page too.
export default async function AdminFlagsPage() {
  const { supabase } = await requireSuperAdmin();

  const [agencies, flags, overrides] = await Promise.all([
    listAdminAgencies(supabase),
    listFeatureFlags(supabase),
    listAgencyFlagOverrides(supabase),
  ]);

  const boardAgencies: BoardAgency[] = agencies.map((a) => ({
    id: a.id,
    name: a.name,
    owner_email: a.owner_email,
  }));

  const boardFlags: BoardFlag[] = flags.map((f) => ({
    key: f.key,
    description: f.description,
    defaultVariant: f.default_variant ?? "off",
    defaultEnabled: f.default_enabled,
  }));

  // Effective variant per (agency, flag): override wins, else the global default.
  const effective: Record<string, string> = {};
  for (const a of agencies) {
    for (const f of flags) {
      const ov = overrides.get(`${a.id}:${f.key}`);
      effective[`${a.id}:${f.key}`] = ov?.variant ?? f.default_variant ?? "off";
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Feature flags</h1>
        <p className="mt-1 text-sm text-muted">
          Per-agency overrides of global defaults. Writes are super-admin-only
          (enforced server-side and by RLS).
        </p>
      </div>
      <FlagsBoard agencies={boardAgencies} flags={boardFlags} effective={effective} />
    </div>
  );
}
