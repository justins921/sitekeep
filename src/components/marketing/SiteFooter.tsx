import Link from "next/link";
import { Spark } from "@/components/ui";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 font-bold text-ink">
          <Spark className="text-brand" />
          <span className="tracking-tight">SiteKeep</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
          <Link href="/signup" className="hover:text-ink focus-ring transition-colors">Get started</Link>
          <Link href="/terms" className="hover:text-ink focus-ring transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-ink focus-ring transition-colors">Privacy</Link>
          <a href="mailto:payton@sitekeep.com" className="hover:text-ink focus-ring transition-colors">
            payton@sitekeep.com
          </a>
          <span>© 2025. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
