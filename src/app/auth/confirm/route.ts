import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Only allow same-site relative paths as the post-confirm destination. */
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

/**
 * Auth email callback (signup confirmation AND password recovery). Supabase's
 * link lands here with either a PKCE `code` or a `token_hash` + `type`; we
 * exchange it for a session, then forward to `next` (the dashboard, or the
 * password-reset page for recovery). Invalid/expired links bounce to /login
 * with a friendly message.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  const supabase = await createClient();

  let failure: string | null = null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failure = error?.message ?? null;
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    failure = error?.message ?? null;
  } else {
    failure = "invalid";
  }

  if (failure) {
    const msg =
      "This confirmation link is invalid or has expired. Try logging in, or request a new link.";
    return NextResponse.redirect(`${siteUrl()}/login?error=${encodeURIComponent(msg)}`);
  }

  return NextResponse.redirect(`${siteUrl()}${next}`);
}
