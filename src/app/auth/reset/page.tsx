import Link from "next/link";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ResetForm } from "./ResetForm";

export const dynamic = "force-dynamic";

/**
 * Password-reset page. The user arrives here from the email link via
 * /auth/confirm, which exchanged the recovery token for a session — so a valid
 * session means the link was good. No session → the link was invalid/expired.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <Card className="p-8">
      <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
      {user ? (
        <>
          <p className="mt-1 text-sm text-muted">
            Choose a new password for your account.
          </p>
          <div className="mt-6">
            <ResetForm />
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 rounded-xl bg-fill-pink px-4 py-3 text-sm text-accent-magenta">
            This reset link is invalid or has expired.
          </p>
          <p className="mt-4 text-center text-sm text-muted">
            <Link
              href="/forgot-password"
              className="font-medium text-brand hover:underline"
            >
              Request a new reset link
            </Link>
          </p>
        </>
      )}
    </Card>
  );
}
