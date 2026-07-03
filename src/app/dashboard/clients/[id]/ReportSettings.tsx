"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import {
  updateReportSettingsAction,
  sendTestReportAction,
  type ReportSettingsState,
} from "./report-actions";

const inputClass =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand/20";

export function ReportSettings({
  clientId,
  defaults,
}: {
  clientId: string;
  defaults: {
    enabled: boolean;
    send_day: number;
    recipient_email: string | null;
    last_sent_at: string | null;
  };
}) {
  const action = updateReportSettingsAction.bind(null, clientId);
  const [state, formAction, pending] = useActionState<ReportSettingsState, FormData>(
    action,
    null,
  );

  const [testing, startTest] = useTransition();
  const [testMsg, setTestMsg] = useState<string | null>(null);

  function sendTest() {
    setTestMsg(null);
    startTest(async () => {
      const res = await sendTestReportAction(clientId);
      if (res.status === "error") setTestMsg(res.error);
      else if (res.status === "skipped")
        setTestMsg("Rendered OK — email skipped (no RESEND_API_KEY set).");
      else setTestMsg("Test report sent.");
    });
  }

  return (
    <form action={formAction} className="space-y-5">
      <label className="flex items-center gap-3 rounded-xl border border-line bg-canvas-alt px-4 py-3">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={defaults.enabled}
          className="h-4 w-4 accent-brand"
        />
        <span className="text-sm text-ink">
          Email a monthly report to the client
        </span>
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="recipient_email" className="text-sm font-medium text-ink">
            Recipient email
          </label>
          <input
            id="recipient_email"
            name="recipient_email"
            type="email"
            defaultValue={defaults.recipient_email ?? ""}
            placeholder="client@company.com"
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="send_day" className="text-sm font-medium text-ink">
            Send on day of month
          </label>
          <input
            id="send_day"
            name="send_day"
            type="number"
            min="1"
            max="31"
            defaultValue={defaults.send_day}
            className={inputClass}
          />
        </div>
      </div>

      {state && "error" in state && (
        <p className="rounded-xl bg-fill-pink px-4 py-3 text-sm text-accent-magenta">
          {state.error}
        </p>
      )}
      {state && "ok" in state && (
        <p className="rounded-xl bg-fill-green px-4 py-3 text-sm text-accent-green">
          Report schedule saved.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save schedule"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={sendTest}
          disabled={testing}
        >
          {testing ? "Sending…" : "Send test report now"}
        </Button>
        {testMsg && <span className="text-sm text-muted">{testMsg}</span>}
      </div>

      {defaults.last_sent_at && (
        <p className="text-xs text-muted">
          Last sent {new Date(defaults.last_sent_at).toLocaleString()}
        </p>
      )}
    </form>
  );
}
