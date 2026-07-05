"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Manage a client's Clicks mapping + the agency's Clicks credential. All writes
// go through the RLS client: clients.clicks_project_id is member-writable
// (owns_client) and agency_clicks_connections is member-writable (is_agency_member).
// The credential is write-only from the UI — it's never read back to the browser.

export type SaveClicksResult = { ok: true } | { ok: false; error: string };

export async function saveClicksConnectionAction(
  clientId: string,
  input: { projectId: string; authMode: "session" | "token"; credential: string },
): Promise<SaveClicksResult> {
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("agency_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return { ok: false, error: "Client not found." };

  // Per-client project id (blank clears the mapping).
  const trimmed = input.projectId.trim();
  const projectId = trimmed === "" ? null : Number(trimmed);
  if (projectId !== null && !Number.isInteger(projectId)) {
    return { ok: false, error: "Project id must be a whole number." };
  }
  const { error: upErr } = await supabase
    .from("clients")
    .update({ clicks_project_id: projectId })
    .eq("id", clientId);
  if (upErr) return { ok: false, error: upErr.message };

  // Per-agency credential — only written when a new value is supplied.
  const credential = input.credential.trim();
  if (credential) {
    const { error: connErr } = await supabase.from("agency_clicks_connections").upsert(
      {
        agency_id: client.agency_id,
        auth_mode: input.authMode,
        credential,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agency_id" },
    );
    if (connErr) return { ok: false, error: connErr.message };
  } else {
    // No new credential: still allow switching the mode of an existing connection.
    await supabase
      .from("agency_clicks_connections")
      .update({ auth_mode: input.authMode, updated_at: new Date().toISOString() })
      .eq("agency_id", client.agency_id);
  }

  revalidatePath(`/dashboard/clients/${clientId}/settings`);
  revalidatePath(`/dashboard/clients/${clientId}`);
  return { ok: true };
}

export async function disconnectClicksAction(clientId: string): Promise<SaveClicksResult> {
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("agency_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return { ok: false, error: "Client not found." };

  const { error } = await supabase
    .from("agency_clicks_connections")
    .delete()
    .eq("agency_id", client.agency_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/clients/${clientId}/settings`);
  return { ok: true };
}
