"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import type { OnboardingChecklist as Checklist } from "@/lib/onboarding";
import { dismissOnboardingAction } from "@/app/dashboard/onboarding-actions";

/**
 * Post-signup activation checklist. Shows the next actions to get to value,
 * with a live progress bar. The first not-yet-done step is highlighted as the
 * suggested next move. Dismissable once the owner has their bearings.
 */
export function OnboardingChecklist({ checklist }: { checklist: Checklist }) {
  const [pending, startTransition] = useTransition();
  const nextKey = checklist.steps.find((s) => !s.done)?.key;
  const pct = Math.round((checklist.completed / checklist.total) * 100);

  return (
    <div className="mb-8 rounded-[var(--radius-card-lg)] border border-line bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Get set up</h2>
          <p className="mt-0.5 text-sm text-muted">
            {checklist.completed} of {checklist.total} done — a few steps to a client-ready dashboard.
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss checklist"
          disabled={pending}
          onClick={() => startTransition(() => dismissOnboardingAction())}
          className="focus-ring rounded-lg p-1.5 text-muted transition-colors hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-canvas-alt">
        <div
          className="h-full rounded-full bg-keep transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-5 space-y-2">
        {checklist.steps.map((step) => {
          const isNext = step.key === nextKey;
          return (
            <li
              key={step.key}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                isNext ? "border-brand bg-brand-50" : "border-line"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  step.done ? "bg-keep text-white" : "border border-line bg-canvas-alt"
                }`}
              >
                {step.done && <Check className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${step.done ? "text-muted line-through" : "text-ink"}`}>
                  {step.title}
                </p>
                {!step.done && <p className="text-xs text-muted">{step.description}</p>}
              </div>
              {!step.done && (
                <Link
                  href={step.href}
                  className="focus-ring flex shrink-0 items-center gap-1 rounded-lg text-sm font-medium text-brand transition-colors hover:text-brand-hover"
                >
                  {step.cta} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
