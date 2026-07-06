import { Card } from "@/components/ui";

export type ResolvedNudge = { key: string; name: string; url: string; reason: string };

/**
 * Agency-only upsell nudge. Rendered ONLY when a real opportunity fires on this
 * client's dashboard (see computeUpsells), so it reads as a smart suggestion —
 * not a standing ad — and each card names the specific gap. Never shown on the
 * public white-label dashboard. Links are affiliate links (rel="sponsored").
 */
export function GrowAccountCTA({ nudges }: { nudges: ResolvedNudge[] }) {
  if (nudges.length === 0) return null;

  return (
    <Card tint="blue" className="p-6">
      <h3 className="text-base font-bold text-ink">Grow this account</h3>
      <p className="mt-1 text-sm text-body">
        We spotted opportunities on this dashboard — offer them as a paid service, powered by the
        tools we use.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {nudges.map((n) => (
          <a
            key={n.key}
            href={n.url}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="group flex flex-col rounded-[var(--radius-card)] border border-brand-100 bg-white p-4 transition-shadow hover:shadow-soft-md"
          >
            <span className="text-sm text-body">{n.reason}</span>
            <span className="mt-2 text-sm font-bold text-brand group-hover:text-brand-hover">
              Try {n.name} →
            </span>
          </a>
        ))}
      </div>
    </Card>
  );
}
