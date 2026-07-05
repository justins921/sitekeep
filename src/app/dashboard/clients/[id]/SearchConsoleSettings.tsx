"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { setGscSiteAction } from "./gsc-actions";

/**
 * Search Console property field in the search_console service settings. Persists
 * to client_services.config.gsc_site_url. Reuses the GA4 service account — the
 * hint tells the agency to add that same email as a user on the GSC property.
 */
export function SearchConsoleSettings({
  clientId,
  initialSiteUrl,
  serviceAccountEmail,
  connected,
  connectionError,
}: {
  clientId: string;
  initialSiteUrl: string | null;
  serviceAccountEmail: string | null;
  connected: boolean;
  connectionError?: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialSiteUrl ?? "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function save() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await setGscSiteAction(clientId, value);
      if ("error" in res) setErr(res.error);
      else {
        setMsg("Saved. Refresh metrics to pull live Search Console data.");
        router.refresh();
      }
    });
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Google Search Console</p>
        <span className={`text-xs font-medium ${connected ? "text-accent-green" : "text-muted"}`}>
          {connected ? "Connected — showing live search data" : "Not connected"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1 space-y-1.5">
          <label htmlFor="gsc_site_url" className="text-xs font-medium text-muted">
            Property (URL-prefix or domain)
          </label>
          <input
            id="gsc_site_url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://www.example.com/  or  sc-domain:example.com"
            className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      {connectionError && !connected && (
        <div className="mt-3 rounded-xl border border-pink-100 bg-fill-pink px-3.5 py-2.5">
          <p className="text-xs font-semibold text-accent-magenta">
            Last refresh couldn&apos;t connect
          </p>
          <p className="mt-0.5 text-xs text-body">{connectionError}</p>
        </div>
      )}
      {serviceAccountEmail ? (
        <p className="mt-3 text-xs text-muted">
          In Search Console →{" "}
          <span className="font-medium text-ink">Settings → Users and permissions</span>, add{" "}
          <span className="font-medium text-ink">{serviceAccountEmail}</span> as a user, then paste
          the property URL here. For a <span className="font-medium text-ink">Domain</span> property,
          use <code>sc-domain:example.com</code>.
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted">
          Set <code>GA4_SERVICE_ACCOUNT_KEY</code> in the environment to enable Search Console
          (it reuses the same service account). Until then this stays not-connected.
        </p>
      )}
      {msg && <p className="mt-2 text-xs text-accent-green">{msg}</p>}
      {err && <p className="mt-2 text-xs text-accent-magenta">{err}</p>}
    </Card>
  );
}
