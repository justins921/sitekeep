"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@/components/ui";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_CATEGORY_META,
  type ActivityEntry,
} from "@/lib/activity";
import {
  addActivityAction,
  deleteActivityAction,
  updateActivityAction,
  type ActivityActionResult,
} from "./activity-actions";

const inputClass =
  "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand/20";

type Fields = { title: string; description: string; category: string; performed_at: string };

const empty: Fields = { title: "", description: "", category: "", performed_at: "" };

function EntryForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial: Fields;
  submitLabel: string;
  pending: boolean;
  onSubmit: (f: Fields) => void;
  onCancel?: () => void;
}) {
  const [f, setF] = useState<Fields>(initial);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
        <input
          aria-label="What did you do?"
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          placeholder="What did you do? e.g. Updated the homepage hero"
          className={inputClass}
        />
        <input
          type="date"
          aria-label="Date performed"
          value={f.performed_at}
          onChange={(e) => setF({ ...f, performed_at: e.target.value })}
          className={inputClass}
        />
      </div>
      <textarea
        aria-label="Details"
        value={f.description}
        onChange={(e) => setF({ ...f, description: e.target.value })}
        placeholder="Details (optional)"
        rows={2}
        className={inputClass}
      />
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Category"
          value={f.category}
          onChange={(e) => setF({ ...f, category: e.target.value })}
          className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">No category</option>
          {ACTIVITY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {ACTIVITY_CATEGORY_META[c].label}
            </option>
          ))}
        </select>
        <Button size="sm" disabled={pending} onClick={() => onSubmit(f)}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-muted hover:text-ink focus-ring transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export function ActivityLog({
  clientId,
  initial,
}: {
  clientId: string;
  initial: ActivityEntry[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [addKey, setAddKey] = useState(0); // reset the add form after submit

  function run(fn: () => Promise<ActivityActionResult>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else onOk?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <p className="mb-3 text-sm font-semibold text-ink">Add an entry</p>
        <EntryForm
          key={addKey}
          initial={empty}
          submitLabel="Add entry"
          pending={pending}
          onSubmit={(f) => run(() => addActivityAction(clientId, f), () => setAddKey((k) => k + 1))}
        />
      </Card>

      {error && <p className="text-sm text-accent-magenta">{error}</p>}

      {initial.length === 0 ? (
        <Card className="p-6 text-sm text-muted">
          No activity logged yet. Add what you&apos;ve done this month — it shows on
          the client&apos;s dashboard and report.
        </Card>
      ) : (
        <div className="space-y-3">
          {initial.map((entry) => {
            const cat = entry.category
              ? ACTIVITY_CATEGORY_META[entry.category as keyof typeof ACTIVITY_CATEGORY_META]
              : null;
            if (editing === entry.id) {
              return (
                <Card key={entry.id} className="p-5">
                  <EntryForm
                    initial={{
                      title: entry.title,
                      description: entry.description ?? "",
                      category: entry.category ?? "",
                      performed_at: entry.performed_at.slice(0, 10),
                    }}
                    submitLabel="Save"
                    pending={pending}
                    onCancel={() => setEditing(null)}
                    onSubmit={(f) =>
                      run(() => updateActivityAction(clientId, entry.id, f), () => setEditing(null))
                    }
                  />
                </Card>
              );
            }
            return (
              <Card key={entry.id} className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {cat && <Badge tone={cat.tone}>{cat.label}</Badge>}
                    <p className="font-semibold text-ink">{entry.title}</p>
                  </div>
                  {entry.description && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-body">
                      {entry.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    {new Date(entry.performed_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setEditing(entry.id)}
                    className="text-xs font-medium text-brand disabled:opacity-50 focus-ring"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => deleteActivityAction(clientId, entry.id))}
                    className="text-xs font-medium text-muted hover:text-accent-magenta disabled:opacity-50 focus-ring transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
