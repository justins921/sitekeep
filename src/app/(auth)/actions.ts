"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState =
  | { error: string }
  | { ok: "check_email"; email: string }
  | null;

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

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

  redirect("/dashboard");
}

export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const agencyName = String(formData.get("agency_name") ?? "").trim();

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // The confirmation link lands on our callback route, which exchanges the
      // token for a session and forwards to the dashboard.
      emailRedirectTo: `${siteUrl()}/auth/confirm`,
      // Consumed by the auth.users trigger to name the agency on first login.
      data: { agency_name: agencyName || "My Agency" },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // When email confirmation is disabled, Supabase returns an active session and
  // the user is signed in immediately. Otherwise, show the check-your-inbox state.
  if (data.session) {
    redirect("/dashboard");
  }

  return { ok: "check_email", email };
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
