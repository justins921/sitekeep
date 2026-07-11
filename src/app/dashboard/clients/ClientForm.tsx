"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import type { ClientFormState } from "./actions";

type Action = (
  prev: ClientFormState,
  formData: FormData,
) => Promise<ClientFormState>;

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand/20";
const labelClass = "text-sm font-medium text-ink";

export type ClientDefaults = {
  company_name?: string;
  website_url?: string;
  contact_email?: string | null;
  monthly_rate?: number;
  is_active?: boolean;
};

export function ClientForm({
  action,
  defaults,
  submitLabel,
  showActive = false,
}: {
  action: Action;
  defaults?: ClientDefaults;
  submitLabel: string;
  showActive?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="company_name" className={labelClass}>
          Company name
        </label>
        <input
          id="company_name"
          name="company_name"
          type="text"
          required
          defaultValue={defaults?.company_name}
          placeholder="Acme Co."
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="website_url" className={labelClass}>
          Website URL
        </label>
        <input
          id="website_url"
          name="website_url"
          type="text"
          inputMode="url"
          required
          defaultValue={defaults?.website_url}
          placeholder="acme.com"
          className={inputClass}
        />
        <p className="text-xs text-muted">
          We&apos;ll add https:// automatically if you leave it off.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="contact_email" className={labelClass}>
            Contact email <span className="text-faint">(optional)</span>
          </label>
          <input
            id="contact_email"
            name="contact_email"
            type="email"
            defaultValue={defaults?.contact_email ?? ""}
            placeholder="owner@acme.com"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="monthly_rate" className={labelClass}>
            Monthly rate (USD)
          </label>
          <input
            id="monthly_rate"
            name="monthly_rate"
            type="number"
            min="0"
            step="1"
            defaultValue={defaults?.monthly_rate ?? 0}
            placeholder="0"
            className={inputClass}
          />
        </div>
      </div>

      {showActive && (
        <label className="flex items-center gap-3 rounded-xl border border-line bg-canvas-alt px-4 py-3">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={defaults?.is_active ?? true}
            className="h-4 w-4 accent-brand"
          />
          <span className="text-sm text-ink">
            Active — dashboard is live and billable
          </span>
        </label>
      )}

      {state?.error && (
        <p className="rounded-xl bg-fill-pink px-4 py-3 text-sm text-accent-magenta">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
