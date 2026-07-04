import Link from "next/link";
import { Spark } from "@/components/ui";
import { requireSuperAdmin } from "@/lib/admin";
import { AdminNav } from "./AdminNav";

// Server-side gate: requireSuperAdmin() redirects non-admins to /dashboard with
// no error, so the route's existence is never revealed. Desktop-first shell in
// the same visual system as the rest of the product.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-8 py-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="inline-flex items-center gap-2 font-bold text-ink">
              <Spark className="text-brand" />
              <span className="text-lg tracking-tight">SiteKeep</span>
              <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                Admin
              </span>
            </Link>
            <AdminNav />
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            ← My dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-8 py-10">{children}</main>
    </div>
  );
}
