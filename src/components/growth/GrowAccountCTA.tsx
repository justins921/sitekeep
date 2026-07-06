import { Card } from "@/components/ui";
import { affiliateTools } from "@/lib/affiliate";

/**
 * Agency-only upsell nudge: when an agency spots an opportunity on a client's
 * dashboard (weak AI visibility, thin GBP), point them to tools they can resell
 * as a service. Rendered ONLY on the authed agency view — never on the public
 * white-label dashboard. Links are affiliate links (rel="sponsored").
 */
export function GrowAccountCTA() {
  const tools = affiliateTools();
  if (tools.length === 0) return null;

  return (
    <Card tint="blue" className="p-6">
      <h3 className="text-base font-bold text-ink">Grow this account</h3>
      <p className="mt-1 text-sm text-body">
        Spotted an opportunity? Offer AI-visibility and SEO as a paid service to this client —
        powered by the tools we use.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {tools.map((t) => (
          <a
            key={t.key}
            href={t.url}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="group flex flex-col rounded-[var(--radius-card)] border border-brand-100 bg-white p-4 transition-shadow hover:shadow-soft-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-ink">{t.name}</span>
              <span className="text-sm font-medium text-brand group-hover:text-brand-hover">Try it →</span>
            </div>
            <span className="mt-1 text-xs text-muted">{t.blurb}</span>
          </a>
        ))}
      </div>
    </Card>
  );
}
