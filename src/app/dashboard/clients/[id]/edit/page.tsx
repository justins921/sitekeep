import Link from "next/link";
import { Card } from "@/components/ui";
import { getClientWithServices } from "@/lib/clients";
import { ClientForm } from "../../ClientForm";
import { updateClientAction } from "../../actions";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { client } = await getClientWithServices(id);

  // Bind the client id into the update action so the form stays generic.
  const action = updateClientAction.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/dashboard/clients/${id}`}
        className="text-sm font-medium text-muted hover:text-ink"
      >
        ← {client.company_name}
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Edit client</h1>

      <Card className="mt-8 p-8">
        <ClientForm
          action={action}
          submitLabel="Save changes"
          showActive
          defaults={{
            company_name: client.company_name,
            website_url: client.website_url,
            contact_email: client.contact_email,
            monthly_rate: client.monthly_rate,
            is_active: client.is_active,
          }}
        />
      </Card>
    </div>
  );
}
