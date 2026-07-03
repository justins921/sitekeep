import type { SupabaseClient } from "@supabase/supabase-js";

// Activity log — maintenance work recorded per client. Entries are added by the
// agency by hand, or auto-created by the system (incident resolved, request
// completed). Rendered on client detail, the public dashboard, and the report.

export const ACTIVITY_CATEGORIES = [
  "update",
  "content",
  "fix",
  "incident",
  "request",
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const ACTIVITY_CATEGORY_META: Record<
  ActivityCategory,
  { label: string; tone: "brand" | "green" | "orange" | "magenta" | "neutral" }
> = {
  update: { label: "Update", tone: "brand" },
  content: { label: "Content", tone: "neutral" },
  fix: { label: "Fix", tone: "green" },
  incident: { label: "Incident", tone: "magenta" },
  request: { label: "Request", tone: "orange" },
};

export type ActivityEntry = {
  id: string;
  client_id: string;
  agency_id: string;
  title: string;
  description: string | null;
  category: string | null;
  performed_at: string;
  created_at: string;
};

/**
 * Insert one activity entry. Works with either the request-scoped client (RLS
 * enforces ownership) or the service-role client (cron auto-entries). Never
 * throws — a failed auto-log must not break the surrounding operation.
 */
export async function logActivity(
  supabase: SupabaseClient,
  entry: {
    clientId: string;
    agencyId: string;
    title: string;
    description?: string | null;
    category?: ActivityCategory | null;
    performedAt?: Date;
  },
): Promise<void> {
  try {
    await supabase.from("activity_log").insert({
      client_id: entry.clientId,
      agency_id: entry.agencyId,
      title: entry.title,
      description: entry.description ?? null,
      category: entry.category ?? null,
      performed_at: (entry.performedAt ?? new Date()).toISOString(),
    });
  } catch {
    // best-effort
  }
}
