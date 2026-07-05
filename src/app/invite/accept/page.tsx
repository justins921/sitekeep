import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button, ButtonLink, Card, Spark } from "@/components/ui";
import { acceptInvitationAction } from "./actions";

export const dynamic = "force-dynamic";

type InviteInfo = {
  status: "pending" | "accepted" | "revoked" | "expired" | "not_found";
  email?: string;
  agency_name?: string;
  role?: string;
};

const ERROR_COPY: Record<string, string> = {
  wrong_email: "This invitation was sent to a different email address. Log in with that address to accept it.",
  expired: "This invitation has expired. Ask the agency owner to send a new one.",
  revoked: "This invitation was revoked. Ask the agency owner to send a new one.",
  already_used: "This invitation has already been used.",
  not_found: "This invitation link is invalid.",
  not_authenticated: "Please log in to accept this invitation.",
  error: "Something went wrong accepting this invitation. Please try again.",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-wash flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 font-bold text-ink">
        <Spark className="text-brand" />
        <span className="text-lg tracking-tight">SiteKeep</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token) {
    return (
      <Shell>
        <Card className="p-8 text-center">
          <h1 className="text-xl font-bold text-ink">Invalid invitation</h1>
          <p className="mt-2 text-sm text-muted">This link is missing its invitation token.</p>
        </Card>
      </Shell>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("lookup_invitation", { p_token: token });
  const info = (data as InviteInfo) ?? { status: "not_found" };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const acceptPath = `/invite/accept?token=${encodeURIComponent(token)}`;

  // Non-pending states (or an error passed back from the accept action).
  if (info.status !== "pending" || error) {
    const key = error ?? info.status;
    return (
      <Shell>
        <Card className="p-8 text-center">
          <h1 className="text-xl font-bold text-ink">Can&apos;t accept this invitation</h1>
          <p className="mt-2 text-sm text-muted">
            {ERROR_COPY[key] ?? ERROR_COPY.error}
          </p>
          <div className="mt-6">
            <ButtonLink href="/dashboard" variant="secondary">
              Go to dashboard
            </ButtonLink>
          </div>
        </Card>
      </Shell>
    );
  }

  // Pending + logged out → route through auth, returning here afterwards.
  if (!user) {
    return (
      <Shell>
        <Card className="p-8 text-center">
          <h1 className="text-xl font-bold text-ink">
            Join {info.agency_name ?? "the agency"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            You&apos;ve been invited as a team member{info.email ? ` (${info.email})` : ""}. Log
            in or create an account to accept.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <ButtonLink href={`/signup?next=${encodeURIComponent(acceptPath)}`} size="lg">
              Create an account
            </ButtonLink>
            <ButtonLink
              href={`/login?next=${encodeURIComponent(acceptPath)}`}
              variant="secondary"
              size="lg"
            >
              Log in
            </ButtonLink>
          </div>
        </Card>
      </Shell>
    );
  }

  // Pending + logged in → one click to join.
  return (
    <Shell>
      <Card className="p-8 text-center">
        <h1 className="text-xl font-bold text-ink">
          Join {info.agency_name ?? "the agency"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          You&apos;re signed in as <span className="font-medium text-ink">{user.email}</span>.
          Accept to start managing this agency&apos;s clients.
        </p>
        <form action={acceptInvitationAction.bind(null, token)} className="mt-6">
          <Button type="submit" size="lg" className="w-full">
            Accept invitation
          </Button>
        </form>
      </Card>
    </Shell>
  );
}
