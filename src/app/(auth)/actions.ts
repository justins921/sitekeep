"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeUrl } from "@/lib/utils";

/** Cookie that carries a scan-first visitor's site (and chosen plan) through
 * signup + email confirmation, so the dashboard can auto-import it. */
const PENDING_SITE_COOKIE = "sk_pending_site";

export type AuthState =
  | { error: string }
  | { ok: "check_email"; email: string }
  | null;

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Guard a post-auth redirect target: must be an in-app path, never off-site. */
function safeNext(next: string | null | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase returns "Email not confirmed" when confirmation is required.
    if (/not confirmed/i.test(error.message)) {
      return {
        error:
          "Your email isn't confirmed yet — check your inbox for the confirmation link (or sign up again to resend it).",
      };
    }
    return { error: error.message };
  }

  redirect(next);
}

export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const agencyName = String(formData.get("agency_name") ?? "").trim();
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  // Carry `next` (e.g. an invite-accept URL) through the confirmation callback.
  const confirmUrl =
    next === "/dashboard"
      ? `${siteUrl()}/auth/confirm`
      : `${siteUrl()}/auth/confirm?next=${encodeURIComponent(next)}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: confirmUrl,
      // Consumed by the auth.users trigger to name the agency on first login.
      data: { agency_name: agencyName || "My Agency" },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Scan-first flow: stash the scanned site + chosen plan so the dashboard can
  // auto-import it once the account is live (survives email confirmation).
  const site = normalizeUrl(String(formData.get("site") ?? ""));
  if (site) {
    const plan = String(formData.get("plan") ?? "solo") === "agency" ? "agency" : "solo";
    const store = await cookies();
    store.set(PENDING_SITE_COOKIE, JSON.stringify({ url: site, plan }), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day — long enough to confirm email
    });
  }

  // When email confirmation is disabled, Supabase returns an active session and
  // the user is signed in immediately. Otherwise, show the check-your-inbox state.
  if (data.session) {
    redirect(next);
  }

  return { ok: "check_email", email };
}

export type ResetRequestState = { sent: true; email: string } | { error: string } | null;

/** Send a password-reset email. The link lands on /auth/confirm → /auth/reset. */
export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/auth/reset`,
  });
  // Supabase does not reveal whether the address exists; surface only real
  // errors (e.g. rate limiting) and otherwise show the neutral "sent" state.
  if (error) return { error: error.message };
  return { sent: true, email };
}

export type UpdatePasswordState = { error: string } | null;

/** Set a new password using the active recovery session, then send to login. */
export async function updatePassword(
  _prev: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Those passwords don't match." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your reset link has expired. Request a new one from “Forgot password?”." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  // Drop the recovery session so they log in fresh with the new password.
  await supabase.auth.signOut();
  redirect("/login?reset=1");
}

/** Resend the signup confirmation email (used from the check-your-inbox state). */
export async function resendConfirmation(
  email: string,
): Promise<{ ok?: true; error?: string }> {
  if (!email) return { error: "Missing email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${siteUrl()}/auth/confirm` },
  });
  if (error) return { error: error.message };
  return { ok: true };
}
