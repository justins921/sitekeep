import { Sidebar } from "@/components/dashboard/Sidebar";
import { requireAgency } from "@/lib/agency";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { agency, userEmail } = await requireAgency();

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar agencyName={agency.name} userEmail={userEmail} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
