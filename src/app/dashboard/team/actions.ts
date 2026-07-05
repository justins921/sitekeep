"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveMembership, type Agency } from "@/lib/agency";
import { sendEmail } from "@/lib/email";
import { inviteEmailHtml } from "@/lib/team";

export type InviteState = { error: string } | { ok: string } | null;

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type OwnerCtx = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  agency: Agency;
};

/** Owner-only guard → returns the owner's agency + user, or a typed error. */
async function requireOwner(): Promise<OwnerCtx | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const membership = await resolveMembership(supabase, user.id);
  if (!membership) redirect("/join");
  if (membership.role !== "owner") {
    return { error: "Only the agency owner can manage the team." as const };
  }
  return { supabase, user, agency: membership.agency };
}

export async function inviteMemberAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const ctx = await requireOwner();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user, agency } = ctx;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  // Already a member? (roster carries emails via the definer RPC.)
  const { data: roster } = await supabase.rpc("team_roster");
  const members = (roster as { members?: { email: string | null }[] } | null)?.members ?? [];
  if (members.some((m) => (m.email ?? "").toLowerCase() === email)) {
    return { error: "That person is already on your team." };
  }

  // One active invite per email: revoke any prior pending invite, then insert.
  await supabase
    .from("agency_invitations")
    .update({ status: "revoked" })
    .eq("agency_id", agency.id)
    .eq("email", email)
    .eq("status", "pending");

  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const expires = new Date(Date.now() + 7 * 86_400_000).toISOString();

  const { error } = await supabase.from("agency_invitations").insert({
    agency_id: agency.id,
    email,
    role: "member",
    token,
    invited_by: user.id,
    status: "pending",
    expires_at: expires,
  });
  if (error) return { error: error.message };

  // Send the invite email as the agency (no-op/log without RESEND_API_KEY).
  const inviteUrl = `${siteUrl()}/invite/accept?token=${token}`;
  await sendEmail({
    to: email,
    subject: `You're invited to ${agency.name}`,
    html: inviteEmailHtml(agency.name, agency.brand_color, inviteUrl),
    fromName: agency.name,
  });

  revalidatePath("/dashboard/team");
  return { ok: `Invitation sent to ${email}.` };
}

export async function revokeInviteAction(inviteId: string): Promise<void> {
  const ctx = await requireOwner();
  if ("error" in ctx) return;
  await ctx.supabase
    .from("agency_invitations")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("status", "pending");
  revalidatePath("/dashboard/team");
}

export async function removeMemberAction(userId: string): Promise<void> {
  const ctx = await requireOwner();
  if ("error" in ctx) return;
  // RLS delete policy also enforces owner + role<>'owner'; the app can't remove
  // the owner or reach another agency's rows.
  await ctx.supabase
    .from("agency_members")
    .delete()
    .eq("agency_id", ctx.agency.id)
    .eq("user_id", userId);
  revalidatePath("/dashboard/team");
}
