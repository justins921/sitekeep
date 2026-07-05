import Link from "next/link";
import { Badge } from "@/components/ui";
import { getClientWithServices } from "@/lib/clients";
import { getViewContext } from "@/lib/view-context";
import { ClientTabs } from "./ClientTabs";

// Shared chrome for a single client: the identity header + the tab nav. Each tab
// (Dashboard / Manage / Settings) is its own page that loads only what it needs.
export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { client } = await getClientWithServices(id);
  const { viewingAs } = await getViewContext();

  return (
    <div>
      <Link href="/dashboard" className="text-sm font-medium text-muted hover:text-ink">
        ← Clients
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{client.company_name}</h1>
            {client.is_active ? (
              <Badge tone="green">Active</Badge>
            ) : (
              <Badge tone="neutral">Paused</Badge>
            )}
          </div>
          <a
            href={client.website_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-sm text-brand hover:underline"
          >
            {client.website_url}
          </a>
        </div>
      </div>

      <ClientTabs id={id} readOnly={Boolean(viewingAs)} />

      <div className="mt-8">{children}</div>
    </div>
  );
}
