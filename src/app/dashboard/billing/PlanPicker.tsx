"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui";
import { PLANS, PLAN_TIERS, type BillingInterval, type PlanTier } from "@/lib/plans";
import {
  cancelSubscriptionAction,
  changePlanAction,
  createPortalSession,
  startTrialAction,
} from "./actions";

const FEATURES: Record<PlanTier, string[]> = {
  solo: [
    "Up to 3 sites",
    "Keep Score, uptime, SSL & broken-link monitoring",
    "Client-ready weekly recap emails",
    "Public client dashboards",
  ],
  agency: [
    "Up to 15 sites",
    "Everything in Solo",
    "White-label dashboards & recaps",
    "Your logo, color and reply-to on every client touchpoint",
  ],
};

export function PlanPicker({
  currentPlan,
  subscribed,
  canManage,
}: {
  currentPlan: PlanTier | null;
  subscribed: boolean;
  canManage: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>("year");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(fn: () => Promise<{ url: string } | { ok: true } | { error: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if ("url" in res) window.location.href = res.url;
      else if ("error" in res) setError(res.error);
    });
  }

  return (
    <div>
      {/* Billing interval toggle — annual is the default. */}
      <div className="flex items-center justify-center">
        <div className="inline-flex rounded-full border border-line bg-canvas-alt p-1">
          {(["year", "month"] as BillingInterval[]).map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => setInterval(iv)}
              className={`focus-ring rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                interval === iv ? "bg-brand text-white" : "text-muted hover:text-ink"
              }`}
            >
              {iv === "year" ? "Annual" : "Monthly"}
              {iv === "year" && (
                <span className={interval === iv ? "text-white/80" : "text-keep"}> · 2 months free</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {PLAN_TIERS.map((tier) => {
          const plan = PLANS[tier];
          const isCurrent = currentPlan === tier;
          const price = plan.price[interval];
          const per = interval === "year" ? "yr" : "mo";
          return (
            <div
              key={tier}
              className={`rounded-[var(--radius-card)] border p-6 ${
                isCurrent ? "border-brand ring-1 ring-brand" : "border-line"
              } bg-surface`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-bold text-ink">{plan.name}</h3>
                {isCurrent && (
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand">
                    Current plan
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted">{plan.blurb}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="num text-3xl font-bold text-ink">${price}</span>
                <span className="text-sm text-muted">/ {per}</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-body">
                {FEATURES[tier].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-keep" /> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {!subscribed ? (
                  <Button
                    className="w-full"
                    disabled={pending}
                    onClick={() => act(() => startTrialAction(tier, interval))}
                  >
                    {pending ? "Starting…" : "Start 14-day trial"}
                  </Button>
                ) : isCurrent ? (
                  <Button className="w-full" variant="secondary" disabled>
                    Your plan
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => act(() => changePlanAction(tier, interval))}
                  >
                    {pending ? "Switching…" : `Switch to ${plan.name}`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!subscribed && (
        <p className="mt-4 text-center text-xs text-muted">
          14-day free trial · card required · cancel anytime before it ends.
        </p>
      )}

      {subscribed && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {canManage && (
            <Button variant="ghost" disabled={pending} onClick={() => act(createPortalSession)}>
              Manage payment method
            </Button>
          )}
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => act(cancelSubscriptionAction)}
            className="text-accent-red"
          >
            Cancel plan
          </Button>
        </div>
      )}

      {error && <p className="mt-4 text-center text-sm text-accent-red">{error}</p>}
    </div>
  );
}
