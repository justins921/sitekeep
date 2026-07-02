"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { SERVICE_TYPES, SERVICE_META, type ServiceType } from "@/lib/services";
import { setServiceEnabledAction } from "../actions";

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        on ? "bg-brand" : "bg-line",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
          on ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </span>
  );
}

export function ServiceToggles({
  clientId,
  initial,
}: {
  clientId: string;
  initial: Record<ServiceType, boolean>;
}) {
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(type: ServiceType) {
    const next = !state[type];
    setState((s) => ({ ...s, [type]: next })); // optimistic
    setError(null);
    startTransition(async () => {
      const res = await setServiceEnabledAction(clientId, type, next);
      if (res?.error) {
        setState((s) => ({ ...s, [type]: !next })); // revert
        setError(res.error);
      }
    });
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        {SERVICE_TYPES.map((type) => {
          const meta = SERVICE_META[type];
          const on = state[type];
          return (
            <Card key={type} tint={on ? meta.tint : "white"} className="p-5">
              <button
                type="button"
                onClick={() => toggle(type)}
                disabled={pending}
                aria-pressed={on}
                className="flex w-full items-start justify-between gap-3 text-left disabled:opacity-70"
              >
                <span>
                  <span className="block font-bold text-ink">{meta.label}</span>
                  <span className="mt-1 block text-xs text-body">{meta.blurb}</span>
                </span>
                <Toggle on={on} />
              </button>
            </Card>
          );
        })}
      </div>
      {error && (
        <p className="mt-3 text-sm text-accent-magenta">{error}</p>
      )}
    </div>
  );
}
