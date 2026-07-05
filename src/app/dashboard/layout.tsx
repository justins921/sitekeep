import Link from "next/link";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { getViewContext } from "@/lib/view-context";
import { exitViewAsAction } from "@/app/admin/actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { agency, userEmail, role, isSuperAdmin, viewingAs } = await getViewContext();

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <Sidebar
        agencyName={agency.name}
        userEmail={userEmail}
        role={role}
        isSuperAdmin={isSuperAdmin}
        viewingAs={viewingAs}
      />
      <main className="min-w-0 flex-1">
        {viewingAs && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-100 bg-orange-50 px-4 py-3 sm:px-8">
            <p className="text-sm text-ink">
              👁 Viewing as <strong>{viewingAs}</strong> — read-only support view.
            </p>
            <form action={exitViewAsAction}>
              <button
                type="submit"
                className="rounded-lg border border-orange-100 bg-white px-3 py-1.5 text-xs font-semibold text-accent-orange transition-colors hover:bg-orange-50"
              >
                Exit
              </button>
            </form>
          </div>
        )}
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">{children}</div>
        <footer className="mx-auto max-w-6xl px-4 pb-10 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-sm text-muted">
            <span className="font-medium text-ink">{agency.name}</span>
            <div className="flex items-center gap-4">
              <Link href="/terms" className="hover:text-ink">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-ink">
                Privacy
              </Link>
              <span className="text-faint">Powered by SiteKeep</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
