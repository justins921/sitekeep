"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import {
  ANNOTATION_CATEGORIES,
  ANNOTATION_CATEGORY_META,
  categoryMeta,
  type TrendAnnotation,
} from "@/lib/annotations";
import {
  createAnnotationAction,
  updateAnnotationAction,
  deleteAnnotationAction,
  type AnnotationState,
} from "./annotation-actions";

function fmtDate(d: string): string {
  return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function todayISO(): string {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
}

function AnnotationForm({
  clientId,
  existing,
  onDone,
}: {
  clientId: string;
  existing?: TrendAnnotation;
  onDone: () => void;
}) {
  const action = existing
    ? updateAnnotationAction.bind(null, clientId, existing.id)
    : createAnnotationAction.bind(null, clientId);
  const [state, formAction, pending] = useActionState<AnnotationState, FormData>(
    action,
    null,
  );

  useEffect(() => {
    if (state && "ok" in state && state.ok) onDone();
  }, [state, onDone]);

  return (
    <form
      action={formAction}
      className="rounded-[var(--radius-card)] border border-line bg-surface p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Date</span>
          <input
            type="date"
            name="annotation_date"
            required
            defaultValue={existing?.annotation_date ?? todayISO()}
            className="w-full rounded-xl border border-line px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Category</span>
          <select
            name="category"
            defaultValue={existing?.category ?? ""}
            className="w-full rounded-xl border border-line px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand-100"
          >
            <option value="">— None —</option>
            {ANNOTATION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {ANNOTATION_CATEGORY_META[c].label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block font-medium text-ink">Label</span>
        <input
          type="text"
          name="label"
          required
          maxLength={80}
          defaultValue={existing?.label ?? ""}
          placeholder="e.g. Homepage redesign shipped"
          className="w-full rounded-xl border border-line px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand-100"
        />
      </label>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block font-medium text-ink">Description (optional)</span>
        <textarea
          name="description"
          rows={2}
          defaultValue={existing?.description ?? ""}
          className="w-full rounded-xl border border-line px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand-100"
        />
      </label>

      {state && "error" in state && (
        <p className="mt-2 text-sm text-accent-magenta">{state.error}</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : existing ? "Save" : "Add note"}
        </Button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm font-medium text-muted hover:text-ink focus-ring transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function AnnotationRow({
  clientId,
  annotation,
}: {
  clientId: string;
  annotation: TrendAnnotation;
}) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const meta = categoryMeta(annotation.category);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  if (editing) {
    return (
      <AnnotationForm
        clientId={clientId}
        existing={annotation}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3">
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
        style={{ color: meta.color, backgroundColor: `${meta.color}1a` }}
        aria-hidden
      >
        {meta.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{annotation.label}</span>
          {annotation.auto && (
            <span className="rounded-full bg-canvas-alt px-1.5 py-0.5 text-[10px] font-medium text-muted">
              Auto
            </span>
          )}
        </div>
        {annotation.description && (
          <p className="mt-0.5 text-sm text-body">{annotation.description}</p>
        )}
        <p className="mt-0.5 text-xs text-muted">
          {fmtDate(annotation.annotation_date)} · {meta.label}
        </p>
      </div>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-lg px-2 py-1 text-muted hover:bg-canvas-alt hover:text-ink focus-ring transition-colors"
          aria-label="Note actions"
        >
          ⋯
        </button>
        {menuOpen && (
          <div className="absolute right-0 z-10 mt-1 w-32 overflow-hidden rounded-xl border border-line bg-surface shadow-soft-md">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setEditing(true);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-body hover:bg-canvas-alt focus-ring transition-colors"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setMenuOpen(false);
                startTransition(() => deleteAnnotationAction(clientId, annotation.id));
              }}
              className="block w-full px-3 py-2 text-left text-sm text-accent-magenta hover:bg-fill-pink disabled:opacity-50 focus-ring transition-colors"
            >
              {pending ? "Deleting…" : "Delete"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function AnnotationManager({
  clientId,
  annotations,
}: {
  clientId: string;
  annotations: TrendAnnotation[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-ink">Timeline notes</h3>
          <p className="mt-1 text-sm text-muted">
            Add context to the charts — a redesign, a campaign, an incident. Notes
            appear as markers above and on the client&apos;s dashboard.
          </p>
        </div>
        {!adding && (
          <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(true)}>
            + Add note
          </Button>
        )}
      </div>

      {adding && (
        <div className="mt-4">
          <AnnotationForm clientId={clientId} onDone={() => setAdding(false)} />
        </div>
      )}

      {annotations.length > 0 ? (
        <div className="mt-4 space-y-2">
          {annotations.map((a) => (
            <AnnotationRow key={a.id} clientId={clientId} annotation={a} />
          ))}
        </div>
      ) : (
        !adding && (
          <p className="mt-4 text-sm text-muted">No notes yet.</p>
        )
      )}
    </div>
  );
}
