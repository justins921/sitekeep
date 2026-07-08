import { ButtonLink, Card } from "@/components/ui";

export type ResolvedNudge = { key: string; name: string; url: string; reason: string };

/**
 * Agency-only upsell nudge. Rendered ONLY when a real opportunity fires on this
 * client's dashboard (see computeUpsells), so it reads as a smart suggestion —
 * not a standing ad — and each row names the specific gap. Never shown on the
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
      <ul className="mt-4 divide-y divide-brand-100">
        {nudges.map((n) => (
          <li
            key={n.key}
            className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-sm text-body sm:pr-6">{n.reason}</span>
            <ButtonLink
              href={n.url}
              variant="secondary"
              size="sm"
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="shrink-0"
            >
              Try {n.name}
            </ButtonLink>
          </li>
        ))}
      </ul>
    </Card>
  );
}
