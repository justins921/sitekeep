import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { GreenWeekGrid } from "./GreenWeekGrid";
import { KeepSparkline } from "./KeepSparkline";
import { scoreColor } from "@/lib/design-tokens";
import type { SiteOverview } from "@/lib/keep-score/overview";

type SiteCardClient = {
  id: string;
  company_name: string;
  website_url: string;
  slug: string;
  is_active: boolean;
};

/** Streak copy — recovery-first: celebrate the chain, and when it breaks, keep
 * the history ("previous best") instead of mourning it. */
function streakLine(overview: SiteOverview): string {
  const { streak, incidentFreeDays: days } = overview;
  if (streak.chainWeeks > 0) {
    const weeks = `${streak.chainWeeks} consecutive green week${streak.chainWeeks === 1 ? "" : "s"}`;
    if (days == null) return `No incidents yet · ${weeks}`;
    return `${days} day${days === 1 ? "" : "s"} without an incident · ${weeks}`;
  }
  if (streak.brokeRecently) {
    return `New chain started · previous best ${streak.previousBest} week${streak.previousBest === 1 ? "" : "s"}`;
  }
  return "Monitoring — first weeks incoming";
}

export function SiteCard({
  client,
  overview,
}: {
  client: SiteCardClient;
  overview: SiteOverview;
}) {
  const color = scoreColor(overview.keepScore);

  return (
    <Card hover className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/dashboard/clients/${client.id}`} className="min-w-0 flex-1 rounded focus-ring">
          <h3 className="truncate font-bold text-ink">{client.company_name}</h3>
          <p className="mt-0.5 truncate text-sm text-muted">{client.website_url}</p>
        </Link>
        {!client.is_active && <Badge tone="neutral">Paused</Badge>}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Keep Score</p>
          <p className="num text-4xl font-bold leading-none" style={{ color }}>
            {overview.keepScore ?? "—"}
          </p>
        </div>
        <KeepSparkline points={overview.weeks.map((w) => w.score)} color={color} />
      </div>

      <div className="mt-4">
        <GreenWeekGrid weeks={overview.weeks} />
        <p className="mt-2 text-xs text-muted">{streakLine(overview)}</p>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
        <Link
          href={`/dashboard/clients/${client.id}`}
          className="rounded text-sm font-medium text-brand transition-colors hover:text-brand-hover focus-ring"
        >
          Open site
        </Link>
        <a
          href={`/d/${client.slug}`}
          target="_blank"
          rel="noreferrer"
          className="rounded text-sm font-medium text-muted transition-colors hover:text-brand focus-ring"
        >
          Client view →
        </a>
      </div>
    </Card>
  );
}
