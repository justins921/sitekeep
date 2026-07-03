"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { requestPasswordReset, type ResetRequestState } from "../actions";

const inputClass =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand/20";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ResetRequestState, FormData>(
    requestPasswordReset,
    null,
  );

  if (state && "sent" in state) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fill-blue text-2xl">
          ✉️
        </div>
        <p className="mt-4 text-sm text-muted">
          If an account exists for{" "}
          <span className="font-medium text-ink">{state.email}</span>, we&apos;ve sent
          a password-reset link. Check your inbox (and spam).
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium text-ink">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@agency.com"
          className={inputClass}
        />
      </div>
      {state && "error" in state && (
        <p className="rounded-xl bg-fill-pink px-4 py-3 text-sm text-accent-magenta">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
