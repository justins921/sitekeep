import Link from "next/link";
import { Spark } from "@/components/ui";

// Mirrors the (auth) layout so /auth/* pages (e.g. the password-reset page)
// share the same branded, centered-card shell.
export default function AuthSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-wash flex min-h-screen flex-col">
      <header className="px-6 py-6">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-ink">
          <Spark className="text-brand" />
          <span className="text-lg tracking-tight">SiteKeep</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
