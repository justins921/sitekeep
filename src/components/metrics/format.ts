export type Rating = "good" | "ni" | "poor" | "none";

export const ratingAccent: Record<Rating, string> = {
  good: "text-accent-green",
  ni: "text-accent-orange",
  poor: "text-accent-magenta",
  none: "text-ink",
};

/** Core Web Vitals thresholds (Google's good / needs-improvement / poor). */
export function rate(
  metric: "lcp" | "cls" | "inp" | "fcp" | "tbt",
  v: number | null,
): Rating {
  if (v === null || v === undefined) return "none";
  const t = {
    lcp: [2500, 4000],
    cls: [0.1, 0.25],
    inp: [200, 500],
    fcp: [1800, 3000],
    tbt: [200, 600],
  }[metric];
  if (v <= t[0]) return "good";
  if (v <= t[1]) return "ni";
  return "poor";
}

export function scoreAccent(score: number | null): string {
  if (score === null) return "text-ink";
  if (score >= 90) return "text-accent-green";
  if (score >= 50) return "text-accent-orange";
  return "text-accent-magenta";
}

// `== null` intentionally covers both null and undefined (a snapshot may omit a
// field), so we never call a numeric method on undefined.
export const ms = (v: number | null | undefined) => (v == null ? "—" : `${v}`);
export const secs = (v: number | null | undefined) =>
  v == null ? "—" : (v / 1000).toFixed(v < 1000 ? 2 : 1);
export const cls = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(2));

/** Compact relative time, e.g. "just now", "3m ago", "2h ago", "5d ago". */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
