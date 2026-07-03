"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui";
import { readableText } from "@/lib/color";
import { submitRequestAction, type RequestFormState } from "./actions";

const inputClass =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-black/10";

/**
 * White-label "Request a change" form on the public dashboard. Posts to the
 * anonymous server action (which inserts via the security-definer RPC). Styled
 * with the agency's accent so it stays on-brand — never SiteKeep branding.
 */
export function RequestChangeForm({ slug, accent }: { slug: string; accent: string }) {
  const action = submitRequestAction.bind(null, slug);
  const [state, formAction, pending] = useActionState<RequestFormState, FormData>(
    action,
    null,
  );
  const onAccent = readableText(accent);

  if (state && "ok" in state) {
    return (
      <Card className="p-6 text-sm text-ink">
        <p className="font-semibold">Thanks — your request was sent.</p>
        <p className="mt-1 text-muted">
          The team has been notified and will follow up if needed.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="req_title" className="text-sm font-medium text-ink">
            What do you need?
          </label>
          <input
            id="req_title"
            name="title"
            type="text"
            required
            maxLength={200}
            placeholder="e.g. Update the hours on our contact page"
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="req_description" className="text-sm font-medium text-ink">
            Details <span className="text-faint">(optional)</span>
          </label>
          <textarea
            id="req_description"
            name="description"
            rows={3}
            maxLength={4000}
            placeholder="Anything else that would help…"
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="req_email" className="text-sm font-medium text-ink">
            Your email <span className="text-faint">(optional)</span>
          </label>
          <input
            id="req_email"
            name="email"
            type="email"
            placeholder="you@company.com"
            className={inputClass}
          />
        </div>

        {state && "error" in state && (
          <p className="rounded-xl bg-fill-pink px-4 py-3 text-sm text-accent-magenta">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl px-5 py-3 text-sm font-semibold shadow-soft transition-opacity disabled:opacity-60"
          style={{ backgroundColor: accent, color: onAccent }}
        >
          {pending ? "Sending…" : "Send request"}
        </button>
      </form>
    </Card>
  );
}
