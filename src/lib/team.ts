import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeHex, readableText } from "@/lib/color";

// Team seats — roster read + invite email. The scoring of who-can-do-what lives
// in RLS + the security-definer RPCs (migration 0014); this is display + email.

export type TeamMember = {
  user_id: string;
  email: string | null;
  role: "owner" | "member";
  created_at: string;
  is_me: boolean;
};
export type TeamInvite = {
  id: string;
  email: string;
  role: "owner" | "member";
  status: string;
  expires_at: string;
  created_at: string;
};
export type TeamRoster = {
  agency_id: string;
  my_role: "owner" | "member";
  members: TeamMember[];
  invitations: TeamInvite[];
};

export async function getTeamRoster(
  supabase: SupabaseClient,
): Promise<TeamRoster | null> {
  const { data } = await supabase.rpc("team_roster");
  return (data as TeamRoster) ?? null;
}

/** Branded invite email. Uses the agency's brand color; no SiteKeep chrome. */
export function inviteEmailHtml(
  agencyName: string,
  brandColor: string,
  inviteUrl: string,
): string {
  const brand = normalizeHex(brandColor);
  const onBrand = readableText(brand);
  return `<!doctype html><html><body style="margin:0;background:#fafafa;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e5e5;">
          <tr><td style="padding:28px 28px 8px;">
            <div style="font:700 18px Arial,sans-serif;color:#0e213d;">You've been invited to ${escapeHtml(agencyName)}</div>
            <p style="font:400 14px Arial,sans-serif;color:#404040;margin:12px 0 0;">
              Join the ${escapeHtml(agencyName)} workspace to help manage client dashboards and reports.
            </p>
            <div style="margin:22px 0 8px;">
              <a href="${inviteUrl}" style="display:inline-block;background:${brand};color:${onBrand};text-decoration:none;font:600 14px Arial,sans-serif;padding:12px 20px;border-radius:12px;">Accept invitation</a>
            </div>
            <p style="font:400 12px Arial,sans-serif;color:#757575;margin:14px 0 0;">
              This link expires in 7 days. If you weren't expecting this, you can ignore it.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
