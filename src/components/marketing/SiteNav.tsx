import Link from "next/link";
import { ButtonLink, Spark } from "@/components/ui";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-ink focus-ring">
          <Spark className="text-brand" />
          <span className="text-lg tracking-tight">SiteKeep</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-body md:flex">
          <a href="#how-it-works" className="hover:text-ink focus-ring transition-colors">How it works</a>
          <a href="#pricing" className="hover:text-ink focus-ring transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-ink focus-ring transition-colors">FAQ</a>
        </nav>

        <div className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost" size="sm">
            Log in
          </ButtonLink>
          <ButtonLink href="/signup" size="sm">
            Try for free
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
