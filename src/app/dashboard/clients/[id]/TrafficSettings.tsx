"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { setGa4PropertyAction } from "./traffic-actions";

/**
 * GA4 property-ID field shown in the traffic service settings on client detail.
 * Persists to client_services.config.ga4_property_id. Includes the sharing hint
 * (grant the service-account email Viewer on the property in GA Admin).
 */
export function TrafficSettings({
  clientId,
  initialPropertyId,
  serviceAccountEmail,
  connected,
}: {
  clientId: string;
  initialPropertyId: string | null;
  serviceAccountEmail: string | null;
  connected: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialPropertyId ?? "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function save() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await setGa4PropertyAction(clientId, value);
      if ("error" in res) setErr(res.error);
      else {
        setMsg("Saved. Refresh metrics to pull live traffic.");
        router.refresh();
      }
    });
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Google Analytics 4</p>
        <span
          className={`text-xs font-medium ${connected ? "text-accent-green" : "text-muted"}`}
        >
          {connected ? "Connected — showing live traffic" : "Not connected — showing demo data"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1 space-y-1.5">
          <label htmlFor="ga4_property_id" className="text-xs font-medium text-muted">
            GA4 Property ID
          </label>
          <input
            id="ga4_property_id"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="numeric"
            placeholder="123456789"
            className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      {serviceAccountEmail ? (
        <p className="mt-3 text-xs text-muted">
          In GA4 → <span className="font-medium text-ink">Admin → Property Access
          Management</span>, add{" "}
          <span className="font-medium text-ink">{serviceAccountEmail}</span> as a
          Viewer, then paste the numeric Property ID here.
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted">
          Set <code>GA4_SERVICE_ACCOUNT_KEY</code> in the environment to enable live
          traffic. Until then this shows labeled demo data.
        </p>
      )}
      {msg && <p className="mt-2 text-xs text-accent-green">{msg}</p>}
      {err && <p className="mt-2 text-xs text-accent-magenta">{err}</p>}
    </Card>
  );
}
