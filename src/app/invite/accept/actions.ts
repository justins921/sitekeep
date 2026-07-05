"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Consume an invite for the logged-in user via the security-definer RPC. On
 * success → dashboard (they're now a member). On any failure → back to the
 * accept page with a typed reason so it can explain what went wrong.
 */
export async function acceptInvitationAction(token: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/accept?token=${token}`)}`);
  }

  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  const result = data as { ok?: boolean; reason?: string } | null;

  if (error || !result?.ok) {
    const reason = result?.reason ?? "error";
    redirect(`/invite/accept?token=${encodeURIComponent(token)}&error=${reason}`);
  }
  redirect("/dashboard");
}
