import Link from "next/link";
import { Card } from "@/components/ui";
import { ClientForm } from "../ClientForm";
import { createClientAction } from "../actions";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard" className="text-sm font-medium text-muted hover:text-ink">
        ← Clients
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Add client</h1>
      <p className="mt-1 text-muted">
        Create a branded dashboard for a client you maintain.
      </p>

      <Card className="mt-8 p-8">
        <ClientForm action={createClientAction} submitLabel="Create client" />
      </Card>
    </div>
  );
}
