import Link from "next/link";
import { Card } from "@/components/ui";
import { AuthForm } from "../AuthForm";
import { signup } from "../actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const joining = Boolean(next && next.startsWith("/invite"));
  return (
    <Card className="p-8">
      <h1 className="text-2xl font-bold tracking-tight">
        {joining ? "Join your team" : "Start keeping clients"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {joining
          ? "Create your account to accept the invitation."
          : "Create your agency and get your first dashboard free."}
      </p>

      <div className="mt-6">
        <AuthForm mode="signup" action={signup} next={next} />
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="font-medium text-brand hover:underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-medium text-brand hover:underline">
          Privacy Policy
        </Link>
        .
      </p>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="font-medium text-brand hover:underline"
        >
          Log in
        </Link>
      </p>
    </Card>
  );
}
