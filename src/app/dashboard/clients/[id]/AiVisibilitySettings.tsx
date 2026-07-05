"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { saveClicksConnectionAction, disconnectClicksAction } from "./clicks-actions";

/**
 * AI Visibility (Clicks) configuration: this client's Clicks project id + the
 * agency's Clicks credential. Two auth modes — 'session' (pilot cookie) and
 * 'token' (official Bearer). The credential is write-only: we show whether one
 * is stored, never its value. Only affects the dashboard when the agency's
 * ai_visibility flag is set to the 'clicks' variant.
 */
export function AiVisibilitySettings({
  clientId,
  initialProjectId,
  connectionMode,
  connected,
}: {
  clientId: string;
  initialProjectId: number | null;
  connectionMode: "session" | "token" | null;
  connected: boolean;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(initialProjectId?.toString() ?? "");
  const [authMode, setAuthMode] = useState<"session" | "token">(connectionMode ?? "session");
  const [credential, setCredential] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function save() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await saveClicksConnectionAction(clientId, { projectId, authMode, credential });
      if (!res.ok) setErr(res.error);
      else {
        setCredential("");
        setMsg("Saved.");
        router.refresh();
      }
    });
  }

  function disconnect() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await disconnectClicksAction(clientId);
      if (!res.ok) setErr(res.error);
      else {
        setMsg("Disconnected.");
        router.refresh();
      }
    });
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">AI Visibility — Clicks connection</p>
        <span className={`text-xs font-medium ${connected ? "text-accent-green" : "text-muted"}`}>
          {connected ? `Connected (${connectionMode})` : "Not connected"}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="clicks_project_id" className="text-xs font-medium text-muted">
            Clicks project id
          </label>
          <input
            id="clicks_project_id"
            inputMode="numeric"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="e.g. 1537"
            className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="clicks_auth_mode" className="text-xs font-medium text-muted">
            Auth mode
          </label>
          <select
            id="clicks_auth_mode"
            value={authMode}
            onChange={(e) => setAuthMode(e.target.value as "session" | "token")}
            className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="session">Session cookie (pilot)</option>
            <option value="token">API token (Bearer)</option>
          </select>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <label htmlFor="clicks_credential" className="text-xs font-medium text-muted">
          {authMode === "token" ? "API token" : "Session cookie (_search_session value)"}
          {connected && " — leave blank to keep the stored credential"}
        </label>
        <textarea
          id="clicks_credential"
          value={credential}
          onChange={(e) => setCredential(e.target.value)}
          rows={2}
          placeholder={connected ? "•••••••• stored" : "Paste the credential"}
          className="w-full rounded-xl border border-line bg-white px-4 py-2.5 font-mono text-xs text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {connected && (
          <Button size="sm" variant="ghost" onClick={disconnect} disabled={pending}>
            Disconnect
          </Button>
        )}
      </div>

      <p className="mt-3 text-xs text-muted">
        Session-cookie mode is pilot-only (the cookie expires). Production Clicks needs an
        official API token — switch to <span className="font-medium text-ink">API token</span>{" "}
        mode once Clicks issues one. The credential is stored per agency and never shown again.
      </p>
      {msg && <p className="mt-2 text-xs text-accent-green">{msg}</p>}
      {err && <p className="mt-2 text-xs text-accent-magenta">{err}</p>}
    </Card>
  );
}
