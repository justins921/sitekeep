"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui";
import {
  sendTestRecapAction,
  setWeeklyRecapAction,
  type TestRecapState,
} from "./actions";

/** Weekly recap controls: Monday on/off toggle + send-a-test. */
export function RecapSettings({ enabled: initial }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [togglePending, startToggle] = useTransition();
  const [testPending, startTest] = useTransition();
  const [testState, setTestState] = useState<TestRecapState | null>(null);

  function toggle() {
    const next = !enabled;
    setEnabled(next); // optimistic
    startToggle(async () => {
      await setWeeklyRecapAction(next);
    });
  }

  function sendTest() {
    setTestState(null);
    startTest(async () => {
      setTestState(await sendTestRecapAction());
    });
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-ink">Weekly recap</h2>
          <p className="mt-1 max-w-md text-sm text-muted">
            Every Monday, get one email rolling up each site&apos;s Keep Score and green-week
            grid — branded as your agency, ready to forward to clients.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          disabled={togglePending}
          className={`focus-ring relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            enabled ? "bg-keep" : "bg-canvas-alt"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button type="button" variant="secondary" onClick={sendTest} disabled={testPending} className="gap-2">
          <Mail className="h-4 w-4" />
          {testPending ? "Sending…" : "Send a test recap"}
        </Button>
        {testState && "ok" in testState && (
          <span className="text-sm text-accent-green">{testState.ok}</span>
        )}
        {testState && "error" in testState && (
          <span className="text-sm text-accent-red">{testState.error}</span>
        )}
      </div>
    </div>
  );
}
