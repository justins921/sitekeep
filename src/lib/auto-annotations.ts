import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertAutoAnnotationOnce } from "./annotations";

// Auto-annotation: after a refresh, flag any trend metric that swung >20% versus
// its previous snapshot ("Significant [metric] change detected"). Marked auto so
// the agency can delete ones that aren't meaningful. Best-effort throughout.

const SWING_THRESHOLD = 20; // percent

type TrendMetric = {
  service_type: "page_speed" | "uptime" | "traffic";
  label: string;
  extract: (data: Record<string, unknown> | null) => number | null;
};

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

const METRICS: TrendMetric[] = [
  {
    service_type: "page_speed",
    label: "page speed",
    extract: (d) =>
      num(
        (d?.mobile as { categories?: { performance?: unknown } } | undefined)?.categories
          ?.performance ?? (d as { performance_score?: unknown } | null)?.performance_score,
      ),
  },
  {
    service_type: "uptime",
    label: "uptime",
    extract: (d) => num((d as { uptime_pct?: unknown } | null)?.uptime_pct),
  },
  {
    service_type: "traffic",
    label: "traffic",
    extract: (d) => num((d as { sessions?: unknown } | null)?.sessions),
  },
];

/**
 * Compare each trend metric's two latest snapshots; when the relative change
 * exceeds ±20%, pin an auto-annotation on today's date. Deduped per day+label.
 */
export async function detectSignificantSwings(
  supabase: SupabaseClient,
  clientId: string,
  agencyId: string,
  now: Date,
): Promise<void> {
  const date = now.toISOString().slice(0, 10);

  for (const metric of METRICS) {
    const { data: rows } = await supabase
      .from("metric_snapshots")
      .select("data, captured_at")
      .eq("client_id", clientId)
      .eq("service_type", metric.service_type)
      .order("captured_at", { ascending: false })
      .limit(2);

    if (!rows || rows.length < 2) continue;
    const current = metric.extract(rows[0].data as Record<string, unknown>);
    const previous = metric.extract(rows[1].data as Record<string, unknown>);
    if (current === null || previous === null || previous === 0) continue;

    const changePct = ((current - previous) / Math.abs(previous)) * 100;
    if (Math.abs(changePct) < SWING_THRESHOLD) continue;

    const dir = changePct > 0 ? "up" : "down";
    const rounded = Math.round(Math.abs(changePct));
    await insertAutoAnnotationOnce(supabase, {
      clientId,
      agencyId,
      date,
      label: `Significant ${metric.label} change detected`,
      description: `${metric.label[0].toUpperCase()}${metric.label.slice(1)} moved ${dir} ${rounded}% (${previous} → ${current}).`,
      category: "update",
    });
  }
}
