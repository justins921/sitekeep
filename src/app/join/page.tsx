import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveMembership } from "@/lib/agency";
import { ButtonLink, Card, Spark } from "@/components/ui";

export const dynamic = "force-dynamic";

type PendingInvite = { token: string; agency_name: string; role: string; expires_at: string };

/**
 * Landing for an authenticated user who belongs to no agency yet — typically an
 * invited user who signed up but hasn't accepted. Surfaces their pending invites
 * so they can join, breaking any redirect loop from the dashboard.
 */
export default async function JoinPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // If they actually do belong to an agency, send them onward.
  const membership = await resolveMembership(supabase, user.id);
  if (membership) redirect("/dashboard");

  const { data } = await supabase.rpc("my_pending_invitations");
  const invites = (data as PendingInvite[]) ?? [];

  return (
    <main className="bg-wash flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 font-bold text-ink focus-ring">
        <Spark className="text-brand" />
        <span className="text-lg tracking-tight">SiteKeep</span>
      </Link>
      <div className="w-full max-w-md">
        <Card className="p-8">
          {invites.length > 0 ? (
            <>
              <h1 className="text-xl font-bold text-ink">You have an invitation</h1>
              <p className="mt-2 text-sm text-muted">
                Accept to join and start managing the agency&apos;s clients.
              </p>
              <div className="mt-6 space-y-3">
                {invites.map((i) => (
                  <div
                    key={i.token}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">{i.agency_name}</p>
                      <p className="text-xs text-muted">as {i.role}</p>
                    </div>
                    <ButtonLink href={`/invite/accept?token=${encodeURIComponent(i.token)}`} size="sm">
                      Accept
                    </ButtonLink>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-ink">No agency yet</h1>
              <p className="mt-2 text-sm text-muted">
                Your account isn&apos;t part of an agency. Ask an agency owner to invite{" "}
                <span className="font-medium text-ink">{user.email}</span>, or create your own
                agency.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <ButtonLink href="/signup">Create an agency</ButtonLink>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="w-full rounded-xl px-3 py-2 text-sm font-medium text-muted hover:text-ink focus-ring transition-colors"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
