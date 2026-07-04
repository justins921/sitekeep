import type { SupabaseClient } from "@supabase/supabase-js";

// Trend annotations — contextual notes pinned to a client's trend charts.
// Client-safe (no server-only imports): the fetch takes whatever Supabase client
// it's given, so it works from server components and the report runner alike.

export const ANNOTATION_CATEGORIES = [
  "redesign",
  "campaign",
  "update",
  "incident",
  "other",
] as const;
export type AnnotationCategory = (typeof ANNOTATION_CATEGORIES)[number];

export const ANNOTATION_CATEGORY_META: Record<
  AnnotationCategory,
  { label: string; icon: string; color: string }
> = {
  redesign: { label: "Redesign", icon: "✦", color: "#0068ff" },
  campaign: { label: "Campaign", icon: "◈", color: "#cb52cc" },
  update: { label: "Update", icon: "⟳", color: "#6cad45" },
  incident: { label: "Incident", icon: "▲", color: "#e87c2e" },
  other: { label: "Note", icon: "•", color: "#757575" },
};

export function categoryMeta(category: string | null | undefined) {
  return (
    ANNOTATION_CATEGORY_META[(category ?? "other") as AnnotationCategory] ??
    ANNOTATION_CATEGORY_META.other
  );
}

export type TrendAnnotation = {
  id: string;
  client_id: string;
  agency_id: string;
  annotation_date: string; // YYYY-MM-DD
  label: string;
  description: string | null;
  category: string | null;
  auto: boolean;
  created_at: string;
  updated_at: string;
};

/** Read-only annotation shape as embedded in the public dashboard RPC. */
export type PublicAnnotation = {
  annotation_date: string;
  label: string;
  description: string | null;
  category: string | null;
  auto: boolean;
};

/** All annotations for a client, chronological (RLS-scoped). */
export async function getAnnotations(
  supabase: SupabaseClient,
  clientId: string,
): Promise<TrendAnnotation[]> {
  const { data } = await supabase
    .from("trend_annotations")
    .select("*")
    .eq("client_id", clientId)
    .order("annotation_date", { ascending: true });
  return (data ?? []) as TrendAnnotation[];
}

/**
 * Insert an auto-generated annotation (auto = true), skipping if an identical
 * one already exists for that client + date + label. Never throws — an auto-note
 * failure must not break the surrounding refresh/cron work. Works with the RLS
 * client (owner refresh) or the service-role client (cron).
 */
export async function insertAutoAnnotationOnce(
  supabase: SupabaseClient,
  entry: {
    clientId: string;
    agencyId: string;
    date: string; // YYYY-MM-DD
    label: string;
    description?: string | null;
    category?: AnnotationCategory | null;
  },
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("trend_annotations")
      .select("id")
      .eq("client_id", entry.clientId)
      .eq("annotation_date", entry.date)
      .eq("label", entry.label)
      .maybeSingle();
    if (existing) return;

    await supabase.from("trend_annotations").insert({
      client_id: entry.clientId,
      agency_id: entry.agencyId,
      annotation_date: entry.date,
      label: entry.label,
      description: entry.description ?? null,
      category: entry.category ?? null,
      auto: true,
    });
  } catch {
    // best-effort
  }
}

/** Annotations within a trailing window (for the email report period). */
export async function getAnnotationsInWindow(
  supabase: SupabaseClient,
  clientId: string,
  sinceISODate: string,
): Promise<TrendAnnotation[]> {
  const { data } = await supabase
    .from("trend_annotations")
    .select("*")
    .eq("client_id", clientId)
    .gte("annotation_date", sinceISODate)
    .order("annotation_date", { ascending: true });
  return (data ?? []) as TrendAnnotation[];
}
