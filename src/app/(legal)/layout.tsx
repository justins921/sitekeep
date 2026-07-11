import Link from "next/link";
import { Spark } from "@/components/ui";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-ink focus-ring">
            <Spark className="text-brand" />
            <span className="tracking-tight">SiteKeep</span>
          </Link>
          <Link href="/signup" className="text-sm font-medium text-brand hover:underline focus-ring">
            Get started
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">{children}</main>
      <SiteFooter />
    </div>
  );
}
