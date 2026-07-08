import Link from "next/link";
import { Card } from "@/components/ui";
import { AuthForm } from "../AuthForm";
import { login } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ confirm?: string; error?: string; reset?: string; next?: string }>;
}) {
  const { confirm, error, reset, next } = await searchParams;

  return (
    <Card className="p-8">
      <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">
        Log in to manage your client dashboards.
      </p>

      {confirm && (
        <p className="mt-4 rounded-xl bg-fill-blue px-4 py-3 text-sm text-brand">
          Check your inbox to confirm your email, then log in.
        </p>
      )}
      {reset && (
        <p className="mt-4 rounded-xl bg-fill-green px-4 py-3 text-sm text-accent-green">
          Password updated — log in with your new password.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl bg-fill-pink px-4 py-3 text-sm text-accent-magenta">
          {error}
        </p>
      )}

      <div className="mt-6">
        <AuthForm mode="login" action={login} next={next} />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        New to SiteKeep?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="font-medium text-brand hover:underline focus-ring"
        >
          Create an account
        </Link>
      </p>
    </Card>
  );
}
