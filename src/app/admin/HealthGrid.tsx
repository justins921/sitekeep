import Link from "next/link";
import { healthBand, HEALTH_BAND_META, type HealthBand } from "@/lib/health";
import type { AdminAgency } from "@/lib/admin";

// Platform-wide red/yellow/green grid: every client across every agency as a
// color-coded tile, so an admin can see at a glance which sites need attention.
// Sorted worst-first within the flat grid.

const ORDER: Record<HealthBand, number> = { red: 0, yellow: 1, green: 2, none: 3 };

const TILE_BG: Record<HealthBand, string> = {
  red: "bg-fill-pink border-pink-100",
  yellow: "bg-orange-50 border-orange-100",
  green: "bg-fill-green border-green-100",
  none: "bg-canvas-alt border-line",
};

export function HealthGrid({ agencies }: { agencies: AdminAgency[] }) {
  const tiles = agencies
    .flatMap((a) =>
      a.clients.map((c) => ({
        ...c,
        agencyName: a.name,
        band: healthBand(c.health),
      })),
    )
    .sort((a, b) => ORDER[a.band] - ORDER[b.band] || (b.health ?? -1) - (a.health ?? -1));

  if (tiles.length === 0) {
    return (
      <p className="rounded-[var(--radius-card)] border border-line bg-white p-6 text-sm text-muted">
        No client dashboards yet.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {(["green", "yellow", "red", "none"] as HealthBand[]).map((band) => (
          <span key={band} className="flex items-center gap-1.5 text-xs text-muted">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: HEALTH_BAND_META[band].dot }}
            />
            {band === "none"
              ? "Not scored"
              : band === "green"
                ? "Healthy (80+)"
                : band === "yellow"
                  ? "Needs attention (50–79)"
                  : "At risk (<50)"}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {tiles.map((t) => (
          <Link
            key={t.id}
            href={`/d/${t.slug}`}
            target="_blank"
            rel="noreferrer"
            className={`flex flex-col justify-between rounded-[var(--radius-card)] border p-4 shadow-soft transition-shadow hover:shadow-soft-md ${TILE_BG[t.band]}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-bold text-ink">
                {t.company_name}
              </span>
              <span
                className="text-lg font-bold leading-none"
                style={{ color: HEALTH_BAND_META[t.band].dot }}
              >
                {t.health === null ? "—" : Math.round(t.health)}
              </span>
            </div>
            <div className="mt-3">
              <p className="truncate text-xs text-muted">{t.agencyName}</p>
              {!t.is_active && (
                <span className="mt-1 inline-block rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                  Paused
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
