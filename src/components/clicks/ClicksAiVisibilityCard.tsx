"use client";

import { useState } from "react";
import { Badge, Card } from "@/components/ui";
import { Gauge } from "@/components/charts/Gauge";
import type { ClicksAiVisibility, ClicksResult } from "@/lib/clicks/types";

const SCORE_META: Record<string, { label: string; color: string }> = {
  poor: { label: "Poor", color: "text-accent-red" },
  good: { label: "Good", color: "text-accent-orange" },
  great: { label: "Great", color: "text-accent-green" },
  unknown: { label: "—", color: "text-muted" },
};

const IMPACT_META: Record<string, { label: string; dot: string; text: string }> = {
  high: { label: "High impact", dot: "bg-accent-red", text: "text-accent-red" },
  medium: { label: "Medium impact", dot: "bg-accent-orange", text: "text-accent-orange" },
  low: { label: "Quick win", dot: "bg-accent-green", text: "text-accent-green" },
  other: { label: "Suggested", dot: "bg-faint", text: "text-muted" },
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function Header({ right }: { right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-bold text-ink">AI Visibility</h3>
        <Badge tone="magenta">via Clicks</Badge>
      </div>
      {right}
    </div>
  );
}

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Card className="p-6">
      <Header right={right} />
      {children}
    </Card>
  );
}

/** Graceful non-data states (expired cookie / not mapped / processing / error). */
function ClicksNotice({ result }: { result: Extract<ClicksResult, { ok: false }> }) {
  const isExpired = result.reason === "expired" || result.reason === "missing";
  return (
    <Shell>
      <p className={"text-sm font-medium " + (isExpired ? "text-accent-orange" : "text-muted")}>
        {isExpired ? "Clicks session expired — paste a fresh cookie" : result.message}
      </p>
      {isExpired && (
        <p className="mt-1 text-sm text-muted">
          Update <code className="rounded bg-canvas-alt px-1 py-0.5 text-xs">CLICKS_SESSION_COOKIE</code>{" "}
          in <code className="rounded bg-canvas-alt px-1 py-0.5 text-xs">.env.local</code> with a current{" "}
          <code className="rounded bg-canvas-alt px-1 py-0.5 text-xs">_search_session</code> value, then refresh.
        </p>
      )}
    </Shell>
  );
}

function ModelPill({ name, cited, statusLabel }: { name: string; cited: boolean; statusLabel: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
      <span className="text-sm font-medium text-ink">{name}</span>
      <span
        className={
          "inline-flex items-center gap-1.5 text-xs font-medium " +
          (cited ? "text-accent-green" : "text-muted")
        }
        title={statusLabel}
      >
        <span className={"inline-block h-2 w-2 rounded-full " + (cited ? "bg-accent-green" : "bg-faint")} />
        {cited ? "Cited" : "Not cited"}
      </span>
    </div>
  );
}

export function ClicksAiVisibilityCard({
  result,
  refreshButton,
}: {
  result: ClicksResult;
  refreshButton?: React.ReactNode;
}) {
  const [showRecs, setShowRecs] = useState(false);

  if (!result.ok) return <ClicksNotice result={result} />;
  const d: ClicksAiVisibility = result.data;
  const score = SCORE_META[d.scoreLabel] ?? SCORE_META.unknown;

  return (
    <Shell
      right={
        <div className="flex items-center gap-3">
          {d.lastRefreshedAt && (
            <span className="text-xs text-muted">
              {d.stale ? "stale · " : ""}updated {timeAgo(d.lastRefreshedAt)}
            </span>
          )}
          {refreshButton}
        </div>
      }
    >
      {d.processing && (
        <p className="mb-4 rounded-xl bg-fill-blue px-4 py-2.5 text-sm text-brand">
          Clicks is still generating this report — showing the latest available data.
        </p>
      )}

      {/* Score + model breakdown */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="flex flex-col items-center">
          <Gauge score={d.scorePct} label="AI visibility" />
          <span className={"mt-1 text-sm font-bold " + score.color}>{score.label}</span>
        </div>
        <div className="flex-1">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Cited in {d.citedCount} of {d.models.length} AI engines
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {d.models.map((m) => (
              <ModelPill key={m.key} name={m.name} cited={m.cited} statusLabel={m.statusLabel} />
            ))}
          </div>
        </div>
      </div>

      {d.explanation && (
        <p className="mt-5 border-t border-line pt-5 text-sm text-body">{d.explanation}</p>
      )}

      {/* Holding back */}
      {d.holdingBack.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">What&apos;s holding it back</p>
          <ul className="grid gap-2">
            {d.holdingBack.slice(0, 4).map((h, i) => (
              <li key={i} className="rounded-xl border border-line p-4">
                <p className="text-sm font-semibold text-ink">{h.title}</p>
                {h.detail && <p className="mt-1 text-sm text-body">{h.detail}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Keyword themes */}
      {d.keywordThemes.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Keyword footprint</p>
          <div className="flex flex-col gap-3">
            {d.keywordThemes.map((t, i) => (
              <div key={i}>
                <p className="mb-1.5 text-sm font-medium text-ink">{t.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {t.keywords.map((k, j) => (
                    <span
                      key={j}
                      className="rounded-full bg-canvas-alt px-2.5 py-1 text-xs font-medium text-muted"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations (collapsible) */}
      {d.recommendations.length > 0 && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowRecs((v) => !v)}
            className="text-sm font-medium text-brand hover:text-brand-hover"
          >
            {showRecs ? "Hide" : "Show"} {d.recommendations.length} recommendation
            {d.recommendations.length === 1 ? "" : "s"}
          </button>
          {showRecs && (
            <ul className="mt-3 grid gap-2">
              {d.recommendations.map((r, i) => {
                const im = IMPACT_META[r.impact] ?? IMPACT_META.other;
                return (
                  <li key={i} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={"inline-flex items-center gap-1.5 text-xs font-semibold " + im.text}>
                        <span className={"inline-block h-2 w-2 rounded-full " + im.dot} />
                        {im.label}
                      </span>
                      <span className="text-sm font-semibold text-ink">{r.title}</span>
                    </div>
                    {r.detail && <p className="mt-1.5 text-sm text-body">{r.detail}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
        AI-visibility data sourced from Clicks.so · pilot integration
      </p>
    </Shell>
  );
}
