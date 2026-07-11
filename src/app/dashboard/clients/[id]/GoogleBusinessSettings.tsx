"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { setGooglePlaceAction } from "./gbp-actions";

/**
 * Google Business location field for the google_business service. The agency
 * types the business name (+ city); we resolve it to a Place ID via the Places
 * API and store it in client_services.config.place_id. A raw Place ID also works.
 */
export function GoogleBusinessSettings({
  clientId,
  initialQuery,
  placeName,
  keyConfigured,
}: {
  clientId: string;
  initialQuery: string;
  placeName: string | null;
  keyConfigured: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function save() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await setGooglePlaceAction(clientId, value);
      if ("error" in res) setErr(res.error);
      else {
        setMsg(res.matched === "Cleared" ? "Cleared." : `Matched: ${res.matched}. Refresh metrics to pull data.`);
        router.refresh();
      }
    });
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Google Business location</p>
        <span className={`text-xs font-medium ${placeName ? "text-accent-green" : "text-muted"}`}>
          {placeName ? "Mapped" : "Not mapped"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1 space-y-1.5">
          <label htmlFor="gbp_query" className="text-xs font-medium text-muted">
            Business name + city (or a Place ID)
          </label>
          <input
            id="gbp_query"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Fox Valley Physical Therapy, Oshkosh WI"
            className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      {placeName && <p className="mt-2 text-xs text-muted">Currently mapped to: {placeName}</p>}
      {!keyConfigured && (
        <p className="mt-3 text-xs text-muted">
          Set <code>GOOGLE_MAPS_API_KEY</code> in the environment to enable this (Places API).
          Until then the card shows labeled demo data.
        </p>
      )}
      {msg && <p className="mt-2 text-xs text-accent-green">{msg}</p>}
      {err && <p className="mt-2 text-xs text-accent-magenta">{err}</p>}
    </Card>
  );
}
