"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { resendConfirmation, type AuthState } from "./actions";

type Action = (prev: AuthState, formData: FormData) => Promise<AuthState>;

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand/20";

function CheckEmail({ email }: { email: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function resend() {
    setMsg(null);
    start(async () => {
      const res = await resendConfirmation(email);
      setMsg(res.error ? res.error : "Confirmation email resent — check your inbox.");
    });
  }

  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fill-blue text-2xl">
        ✉️
      </div>
      <h2 className="mt-4 text-lg font-bold text-ink">Check your inbox</h2>
      <p className="mt-1 text-sm text-muted">
        We sent a confirmation link to <span className="font-medium text-ink">{email}</span>.
        Click it to activate your account, then log in.
      </p>
      <div className="mt-5">
        <Button variant="secondary" onClick={resend} disabled={pending} className="w-full">
          {pending ? "Resending…" : "Resend confirmation email"}
        </Button>
      </div>
      {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}
      <p className="mt-4 text-xs text-faint">
        Wrong address or no email after a minute? Check spam, or resend above.
      </p>
    </div>
  );
}

export function AuthForm({
  mode,
  action,
  next,
  site,
  plan,
}: {
  mode: "login" | "signup";
  action: Action;
  next?: string;
  site?: string;
  plan?: string;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    null,
  );

  if (state && "ok" in state && state.ok === "check_email") {
    return <CheckEmail email={state.email} />;
  }

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {site && <input type="hidden" name="site" value={site} />}
      {plan && <input type="hidden" name="plan" value={plan} />}
      {mode === "signup" && (
        <div className="space-y-1.5">
          <label htmlFor="agency_name" className="text-sm font-medium text-ink">
            Agency name
          </label>
          <input
            id="agency_name"
            name="agency_name"
            type="text"
            placeholder="Acme Studio"
            className={inputClass}
          />
        </div>
      )}

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

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium text-ink">
            Password
          </label>
          {mode === "login" && (
            <a href="/forgot-password" className="text-xs font-medium text-brand hover:underline focus-ring">
              Forgot password?
            </a>
          )}
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "signup" ? 8 : undefined}
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
        {pending
          ? "Please wait…"
          : mode === "login"
            ? "Log in"
            : "Create account"}
      </Button>
    </form>
  );
}
