"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { updatePassword, type UpdatePasswordState } from "../../(auth)/actions";

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand/20";

export function ResetForm() {
  const [state, action, pending] = useActionState<UpdatePasswordState, FormData>(
    updatePassword,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="••••••••"
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm" className="text-sm font-medium text-ink">
          Confirm new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="••••••••"
          className={inputClass}
        />
      </div>
      {state && "error" in state && (
        <p className="rounded-xl bg-fill-pink px-4 py-3 text-sm text-accent-magenta">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
