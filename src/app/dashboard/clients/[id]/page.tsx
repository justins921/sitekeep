import { Button, Card } from "@/components/ui";
import { getClientWithServices } from "@/lib/clients";
import { getLatestSnapshots } from "@/lib/metrics";
import { SERVICE_TYPES } from "@/lib/services";
import { ServiceCard } from "@/components/metrics/ServiceCards";
import { HealthCard } from "@/components/metrics/HealthCard";
import { getClientHealth } from "@/lib/health-scores";
import { AnnotatedTrendCharts } from "@/components/metrics/AnnotatedTrendCharts";
import { AnnotationManager } from "./AnnotationManager";
import { getDatedTrendSeries, TREND_KEYS } from "@/lib/trends";
import { getAnnotations } from "@/lib/annotations";
import { createClient } from "@/lib/supabase/server";
import { getViewContext } from "@/lib/view-context";
import { RefreshButton } from "./RefreshButton";
import { getSubscription, isEntitled } from "@/lib/billing";
import { startClientCheckoutAction, confirmActivateAction } from "../actions";
// --- AI Visibility (flag-gated, multi-source) ---
import { getAiVisibility } from "@/lib/ai-visibility";
import { AiVisibilityCard } from "@/components/ai-visibility/AiVisibilityCard";
import { RefreshAiVisibilityButton } from "@/components/ai-visibility/RefreshAiVisibilityButton";
import { GrowAccountCTA } from "@/components/growth/GrowAccountCTA";
import { computeUpsells } from "@/lib/growth";
import { affiliateTools } from "@/lib/affiliate";
import type { GoogleBusinessData, SearchConsoleData } from "@/lib/metrics/types";
import type { SitePlatform } from "@/lib/site-platform";

// PageSpeed Insights can take 10–20s; give the refresh Server Action (which
// runs in this route's function) room beyond the default timeout.
export const maxDuration = 60;

export default async function ClientDashboardTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    gated?: string;
    subscribed?: string;
    checkout?: string;
    confirm?: string;
  }>;
}) {
  const { id } = await params;
  const { gated, subscribed, checkout, confirm } = await searchParams;
  const { client, services } = await getClientWithServices(id);
  const snapshots = await getLatestSnapshots(id);
  const { viewingAs } = await getViewContext();
  const readOnly = Boolean(viewingAs);

  const supabase = await createClient();
  const sub = await getSubscription(supabase, client.agency_id);
  const entitled = isEntitled(sub?.status);

  const enabledServices = SERVICE_TYPES.filter((t) => services[t]);
  const health = await getClientHealth(supabase, id);
  const trends = await getDatedTrendSeries(supabase, id);
  const annotations = await getAnnotations(supabase, id);
  const trendKeys = TREND_KEYS.filter((k) => services[k]);

  // AI Visibility — flag-gated (getFeature). Returns reason 'disabled' when the
  // agency's flag is off, in which case we render nothing.
  const aiv = await getAiVisibility(client.agency_id, id);
  const showAiv = aiv.ok || aiv.reason !== "disabled";

  // Contextual affiliate nudges — only fire on a real opportunity (see computeUpsells).
  const gbpData = snapshots.google_business?.data as GoogleBusinessData | undefined;
  const gscData = snapshots.search_console?.data as SearchConsoleData | undefined;
  const upsellTools = affiliateTools();
  const growthNudges = readOnly
    ? []
    : computeUpsells({
        aiEnabled: aiv.ok,
        aiCited: aiv.ok ? aiv.data.citedCount : null,
        aiEngines: aiv.ok ? aiv.data.engines.length : null,
        aiScoreLabel: aiv.ok ? aiv.data.scoreLabel : null,
        gbpConnected: Boolean(gbpData?.connected),
        gbpCompleteness: gbpData?.completeness_pct ?? null,
        gbpRating: gbpData?.rating ?? null,
        gbpReviews: gbpData?.reviews_total ?? null,
        gscConnected: Boolean(gscData?.connected),
        gscPosition: gscData?.connected ? gscData.position : null,
        healthScore: health?.score ?? null,
        sitePlatform: (client.site_platform as SitePlatform | null) ?? null,
      })
        .map((n) => {
          const tool = upsellTools.find((t) => t.key === n.key);
          return tool ? { key: tool.key, name: tool.name, url: tool.url, reason: n.reason } : null;
        })
        .filter((n): n is { key: string; name: string; url: string; reason: string } => n !== null);

  // Paused-client activation prompts.
  const showConfirm = confirm === "1" && !client.is_active && entitled;
  const showGate =
    (gated === "1" || checkout === "cancel") && !client.is_active && !entitled;

  return (
    <div>
      {showConfirm && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-brand-100 bg-brand-50 px-5 py-4">
          <p className="text-sm text-ink">
            This site is <strong>paused</strong>. Turn it on — it&apos;s included in your plan.
          </p>
          <form action={confirmActivateAction.bind(null, id)}>
            <Button type="submit" size="sm">
              Turn on monitoring
            </Button>
          </form>
        </div>
      )}

      {showGate && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-brand-100 bg-brand-50 px-5 py-4">
          <p className="text-sm text-ink">
            This site is <strong>paused</strong> — start a 14-day trial to keep it monitored.
          </p>
          <form action={startClientCheckoutAction.bind(null, id)}>
            <Button type="submit" size="sm">
              Start trial to activate
            </Button>
          </form>
        </div>
      )}

      {subscribed === "1" && client.is_active && (
        <div className="mb-6 rounded-[var(--radius-card)] border border-green-100 bg-fill-green px-5 py-4 text-sm text-accent-green">
          Payment received — this dashboard is now active.
        </div>
      )}

      {/* Composite health score — leads the dashboard */}
      {enabledServices.length > 0 && (
        <div className="mb-10">
          <HealthCard health={health} />
        </div>
      )}

      {/* Metrics */}
      <div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Metrics</h2>
            <p className="mt-1 text-sm text-muted">
              Live data for the enabled services. This is what the client sees.
            </p>
          </div>
          {!readOnly && (
            <RefreshButton clientId={id} hasEnabled={enabledServices.length > 0} />
          )}
        </div>

        {enabledServices.length === 0 ? (
          <Card className="mt-5 p-6 text-sm text-muted">
            No services enabled yet. Turn them on in{" "}
            <span className="font-medium text-ink">Settings</span> to start
            collecting metrics.
          </Card>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {enabledServices.map((type) => (
              <div
                key={type}
                className={
                  type === "page_speed" ||
                  type === "traffic" ||
                  type === "search_console" ||
                  type === "accessibility" ||
                  type === "google_business"
                    ? "lg:col-span-2"
                    : ""
                }
              >
                <ServiceCard
                  type={type}
                  data={snapshots[type]?.data ?? null}
                  capturedAt={snapshots[type]?.captured_at}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Visibility — flag-gated, source chosen by the flag variant */}
      {showAiv && (
        <div className="mt-12">
          <h2 className="text-xl font-bold tracking-tight">AI Visibility</h2>
          <p className="mt-1 text-sm text-muted">
            How this site shows up across AI search engines.
          </p>
          <div className="mt-5">
            <AiVisibilityCard
              result={aiv}
              refreshButton={readOnly ? undefined : <RefreshAiVisibilityButton />}
            />
          </div>
        </div>
      )}

      {/* Agency-only upsell nudge — only when a real opportunity fires */}
      {growthNudges.length > 0 && (
        <div className="mt-10">
          <GrowAccountCTA nudges={growthNudges} />
        </div>
      )}

      {/* Trends + annotations */}
      {trendKeys.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-bold tracking-tight">Trends</h2>
          <p className="mt-1 text-sm text-muted">
            History across refreshes. Charts appear once there are at least two
            data points.
          </p>
          <div className="mt-5">
            <AnnotatedTrendCharts series={trends} annotations={annotations} show={trendKeys} />
          </div>
          {!readOnly && <AnnotationManager clientId={id} annotations={annotations} />}
        </div>
      )}
    </div>
  );
}
