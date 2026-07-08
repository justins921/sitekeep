"use client";

import { useState } from "react";
import { Badge, Card, DisclosureButton } from "@/components/ui";
import { Gauge } from "@/components/charts/Gauge";
import type {
  AiVisibility,
  AiVisibilityResult,
} from "@/lib/ai-visibility/types";

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

function Header({ sourceLabel, right }: { sourceLabel: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-bold text-ink">AI Visibility</h3>
        <Badge tone="magenta">via {sourceLabel}</Badge>
      </div>
      {right}
    </div>
  );
}

function Shell({
  sourceLabel,
  right,
  children,
}: {
  sourceLabel: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <Header sourceLabel={sourceLabel} right={right} />
      {children}
    </Card>
  );
}

/** Graceful non-data states (reconnect / not mapped / error). */
function Notice({ result }: { result: Extract<AiVisibilityResult, { ok: false }> }) {
  const sourceLabel = result.source?.label ?? "source";
  const isCred = result.reason === "expired" || result.reason === "missing";
  return (
    <Shell sourceLabel={sourceLabel}>
      <p className={"text-sm font-medium " + (isCred ? "text-accent-orange" : "text-muted")}>
        {isCred ? `Reconnect ${sourceLabel} — credentials expired or missing` : result.message}
      </p>
      {isCred && (
        <p className="mt-1 text-sm text-muted">{result.message}</p>
      )}
    </Shell>
  );
}

function EnginePill({ name, cited, statusLabel }: { name: string; cited: boolean; statusLabel: string }) {
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

/**
 * Source-agnostic AI Visibility card. Renders the normalized AiVisibility shape,
 * so Clicks / standalone / any future source all look identical. Returns null
 * when the flag is disabled (nothing to show).
 */
export function AiVisibilityCard({
  result,
  refreshButton,
}: {
  result: AiVisibilityResult;
  refreshButton?: React.ReactNode;
}) {
  const [showRecs, setShowRecs] = useState(false);

  if (!result.ok) {
    if (result.reason === "disabled") return null;
    return <Notice result={result} />;
  }

  const d: AiVisibility = result.data;
  const score = SCORE_META[d.scoreLabel] ?? SCORE_META.unknown;

  return (
    <Shell
      sourceLabel={d.source.label}
      right={
        <div className="flex items-center gap-3">
          {d.source.demo && <Badge tone="orange">Demo data</Badge>}
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
          Still generating this report — showing the latest available data.
        </p>
      )}

      {/* Score + engine breakdown */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="flex flex-col items-center">
          <Gauge score={d.scorePct} label="AI visibility" />
          <span className={"mt-1 text-sm font-bold " + score.color}>{score.label}</span>
        </div>
        <div className="flex-1">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Cited in {d.citedCount} of {d.engines.length} AI engines
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {d.engines.map((m) => (
              <EnginePill key={m.key} name={m.name} cited={m.cited} statusLabel={m.statusLabel} />
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

      {/* Competitors (optional) */}
      {d.competitors.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Competitors</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[380px] text-left text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="pb-2 font-medium">Competitor</th>
                  <th className="pb-2 text-right font-medium">Score</th>
                  <th className="pb-2 text-right font-medium">Cited</th>
                </tr>
              </thead>
              <tbody>
                {d.competitors.map((c, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-2 pr-3 text-ink">
                      {c.name}
                      {c.domain && <span className="ml-1 text-xs text-muted">{c.domain}</span>}
                    </td>
                    <td className="py-2 text-right font-medium text-ink">{c.score ?? "—"}</td>
                    <td className="py-2 text-right">
                      {c.cited == null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={c.cited ? "text-accent-green" : "text-muted"}>
                          {c.cited ? "Yes" : "No"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tracked prompts (optional) */}
      {d.prompts.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Tracked prompts</p>
          <ul className="grid gap-2">
            {d.prompts.map((p, i) => (
              <li key={i} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      "inline-flex items-center gap-1.5 text-xs font-semibold " +
                      (p.mentioned ? "text-accent-green" : "text-muted")
                    }
                  >
                    <span
                      className={"inline-block h-2 w-2 rounded-full " + (p.mentioned ? "bg-accent-green" : "bg-faint")}
                    />
                    {p.mentioned ? "Mentioned" : "Not mentioned"}
                  </span>
                  <span className="text-sm font-semibold text-ink">{p.prompt}</span>
                  {p.engine && <span className="text-xs text-muted">· {p.engine}</span>}
                </div>
                {p.snippet && <p className="mt-1.5 text-sm text-body">“{p.snippet}”</p>}
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
                    <span key={j} className="rounded-full bg-canvas-alt px-2.5 py-1 text-xs font-medium text-body">
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
          <DisclosureButton open={showRecs} onClick={() => setShowRecs((v) => !v)}>
            {showRecs ? "Hide" : "Show"} {d.recommendations.length} recommendation
            {d.recommendations.length === 1 ? "" : "s"}
          </DisclosureButton>
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
        AI-visibility data sourced from {d.source.label}
        {d.source.demo ? " · demo" : ""}
      </p>
    </Shell>
  );
}
