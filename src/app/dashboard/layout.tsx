import { Sidebar } from "@/components/dashboard/Sidebar";
import { getViewContext } from "@/lib/view-context";
import { exitViewAsAction } from "@/app/admin/actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { agency, userEmail, isSuperAdmin, viewingAs } = await getViewContext();

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar
        agencyName={agency.name}
        userEmail={userEmail}
        isSuperAdmin={isSuperAdmin}
        viewingAs={viewingAs}
      />
      <main className="flex-1 overflow-y-auto">
        {viewingAs && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-100 bg-orange-50 px-8 py-3">
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
        <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
