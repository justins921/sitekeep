import Link from "next/link";
import { Card } from "@/components/ui";
import { normalizeUrl } from "@/lib/utils";
import { AuthForm } from "../AuthForm";
import { signup } from "../actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; site?: string; plan?: string }>;
}) {
  const { next, site: rawSite, plan } = await searchParams;
  const joining = Boolean(next && next.startsWith("/invite"));
  const site = rawSite ? (normalizeUrl(rawSite) ?? undefined) : undefined;
  let siteHost: string | undefined;
  if (site) {
    try {
      siteHost = new URL(site).hostname.replace(/^www\./, "");
    } catch {
      siteHost = undefined;
    }
  }
  return (
    <Card className="p-8">
      <h1 className="text-2xl font-bold tracking-tight">
        {joining ? "Join your team" : site ? "Start monitoring" : "Start keeping clients"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {joining
          ? "Create your account to accept the invitation."
          : siteHost
            ? `Create your account and we'll import ${siteHost} as your first site.`
            : "Create your agency and get your first dashboard free."}
      </p>

      <div className="mt-6">
        <AuthForm
          mode="signup"
          action={signup}
          next={next}
          site={site}
          plan={plan === "agency" ? "agency" : site ? "solo" : undefined}
        />
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="font-medium text-brand hover:underline focus-ring">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-medium text-brand hover:underline focus-ring">
          Privacy Policy
        </Link>
        .
      </p>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="font-medium text-brand hover:underline focus-ring"
        >
          Log in
        </Link>
      </p>
    </Card>
  );
}
