import { redirect } from "next/navigation";

// Editing moved into the client's Settings tab. Keep this route as a redirect so
// old links (and the previous "Edit" button) still land in the right place.
export default async function EditClientRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/clients/${id}/settings`);
}
