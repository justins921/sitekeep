"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/requests";

export type RequestActionResult = { error: string } | null;

async function requireUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
}

/** Move a request between statuses. RLS scopes the update to the owner. */
export async function setRequestStatusAction(
  clientId: string,
  requestId: string,
  status: RequestStatus,
): Promise<RequestActionResult> {
  if (!REQUEST_STATUSES.includes(status)) return { error: "Unknown status." };
  const supabase = await createClient();
  await requireUser(supabase);

  const { error } = await supabase
    .from("client_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/clients/${clientId}`);
  return null;
}

/** Save an internal (agency-only) note on a request. */
export async function saveRequestNoteAction(
  clientId: string,
  requestId: string,
  note: string,
): Promise<RequestActionResult> {
  const supabase = await createClient();
  await requireUser(supabase);

  const { error } = await supabase
    .from("client_requests")
    .update({ internal_note: note.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/clients/${clientId}`);
  return null;
}

/** Delete a request. RLS ensures only the owning agency can remove it. */
export async function deleteRequestAction(
  clientId: string,
  requestId: string,
): Promise<RequestActionResult> {
  const supabase = await createClient();
  await requireUser(supabase);

  const { error } = await supabase.from("client_requests").delete().eq("id", requestId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/clients/${clientId}`);
  return null;
}
