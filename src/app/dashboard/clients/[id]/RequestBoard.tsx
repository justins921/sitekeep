"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import {
  REQUEST_STATUSES,
  REQUEST_STATUS_META,
  type ClientRequest,
  type RequestStatus,
} from "@/lib/requests";
import {
  deleteRequestAction,
  saveRequestNoteAction,
  setRequestStatusAction,
} from "./request-actions";

export function RequestBoard({
  clientId,
  initial,
}: {
  clientId: string;
  initial: ClientRequest[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ error: string } | null>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      router.refresh();
    });
  }

  if (initial.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted">
        No requests yet. When a client submits one from their dashboard, it appears here.
      </Card>
    );
  }

  const columns = REQUEST_STATUSES.map((status) => ({
    status,
    items: initial.filter((r) => r.status === status),
  }));

  return (
    <div>
      {error && <p className="mb-3 text-sm text-accent-magenta">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((col) => (
          <div key={col.status}>
            <div className="mb-3 flex items-center gap-2">
              <Badge tone={REQUEST_STATUS_META[col.status].tone}>
                {REQUEST_STATUS_META[col.status].label}
              </Badge>
              <span className="text-xs text-muted">{col.items.length}</span>
            </div>
            <div className="space-y-3">
              {col.items.map((req) => (
                <RequestCard
                  key={req.id}
                  clientId={clientId}
                  req={req}
                  pending={pending}
                  onRun={run}
                />
              ))}
              {col.items.length === 0 && (
                <div className="rounded-[var(--radius-card)] border border-dashed border-line px-4 py-6 text-center text-xs text-faint">
                  Nothing here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestCard({
  clientId,
  req,
  pending,
  onRun,
}: {
  clientId: string;
  req: ClientRequest;
  pending: boolean;
  onRun: (fn: () => Promise<{ error: string } | null>) => void;
}) {
  const [note, setNote] = useState(req.internal_note ?? "");
  const noteDirty = note.trim() !== (req.internal_note ?? "").trim();

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-ink">{req.title}</p>
      {req.description && (
        <p className="mt-1 whitespace-pre-wrap text-sm text-body">{req.description}</p>
      )}
      <p className="mt-2 text-xs text-muted">
        {req.submitted_by_email ? `${req.submitted_by_email} · ` : ""}
        {new Date(req.created_at).toLocaleDateString()}
      </p>

      <div className="mt-3 space-y-2">
        <select
          aria-label="Change status"
          value={req.status}
          disabled={pending}
          onChange={(e) =>
            onRun(() =>
              setRequestStatusAction(clientId, req.id, e.target.value as RequestStatus),
            )
          }
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          {REQUEST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {REQUEST_STATUS_META[s].label}
            </option>
          ))}
        </select>

        <textarea
          aria-label="Internal note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Internal note (only your team sees this)"
          rows={2}
          className="w-full rounded-lg border border-line bg-canvas-alt px-3 py-2 text-xs text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-brand/20"
        />

        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={pending || !noteDirty}
            onClick={() => onRun(() => saveRequestNoteAction(clientId, req.id, note))}
            className="text-xs font-medium text-brand disabled:text-faint focus-ring"
          >
            Save note
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onRun(() => deleteRequestAction(clientId, req.id))}
            className="text-xs font-medium text-muted hover:text-accent-magenta disabled:opacity-50 focus-ring transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </Card>
  );
}
