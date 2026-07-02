import Link from "next/link";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { getClientWithServices } from "@/lib/clients";
import { ServiceToggles } from "./ServiceToggles";
import { DeleteClientButton } from "./DeleteClientButton";
import { CopyLinkButton } from "./CopyLinkButton";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { client, services } = await getClientWithServices(id);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const publicUrl = `${siteUrl}/d/${client.slug}`;

  return (
    <div>
      <Link href="/dashboard" className="text-sm font-medium text-muted hover:text-ink">
        ← Clients
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {client.company_name}
            </h1>
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

        <div className="flex items-center gap-2">
          <ButtonLink href={`/dashboard/clients/${id}/edit`} variant="secondary" size="sm">
            Edit
          </ButtonLink>
          <DeleteClientButton clientId={id} clientName={client.company_name} />
        </div>
      </div>

      {/* Summary */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm font-medium text-muted">Monthly rate</p>
          <p className="mt-2 text-2xl font-bold text-ink">
            ${Number(client.monthly_rate).toFixed(0)}
            <span className="text-sm font-medium text-muted">/mo</span>
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-muted">Contact</p>
          <p className="mt-2 truncate text-sm text-ink">
            {client.contact_email ?? "—"}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-muted">Public dashboard</p>
          <div className="mt-2 flex items-center gap-2">
            <CopyLinkButton url={publicUrl} />
            <ButtonLink href={`/d/${client.slug}`} variant="ghost" size="sm">
              Open
            </ButtonLink>
          </div>
        </Card>
      </div>

      {/* Services */}
      <div className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">Services</h2>
        <p className="mt-1 text-sm text-muted">
          Toggle what appears on this client&apos;s dashboard. Changes save instantly.
        </p>
        <div className="mt-5">
          <ServiceToggles clientId={id} initial={services} />
        </div>
      </div>
    </div>
  );
}
