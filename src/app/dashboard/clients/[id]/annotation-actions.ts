"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ANNOTATION_CATEGORIES, type AnnotationCategory } from "@/lib/annotations";

// Manual annotation CRUD. All writes go through the RLS client, so owns_client()
// scopes every operation to the owning agency — a non-owned client id simply
// affects zero rows.

export type AnnotationState = { error: string } | { ok: true } | null;

type Parsed = {
  label: string;
  annotation_date: string;
  description: string | null;
  category: AnnotationCategory | null;
};

function parse(formData: FormData): { error: string } | { values: Parsed } {
  const label = String(formData.get("label") ?? "").trim();
  const annotation_date = String(formData.get("annotation_date") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const rawCategory = String(formData.get("category") ?? "").trim();
  const category = ANNOTATION_CATEGORIES.includes(rawCategory as AnnotationCategory)
    ? (rawCategory as AnnotationCategory)
    : null;

  if (!label) return { error: "Add a short label." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(annotation_date)) {
    return { error: "Pick a valid date." };
  }
  return { values: { label, annotation_date, description, category } };
}

export async function createAnnotationAction(
  clientId: string,
  _prev: AnnotationState,
  formData: FormData,
): Promise<AnnotationState> {
  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // agency_id is required on the row; read it from the (RLS-visible) client.
  const { data: client } = await supabase
    .from("clients")
    .select("agency_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return { error: "Client not found." };

  const { error } = await supabase.from("trend_annotations").insert({
    client_id: clientId,
    agency_id: client.agency_id,
    auto: false,
    ...parsed.values,
  });
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { ok: true };
}

export async function updateAnnotationAction(
  clientId: string,
  annotationId: string,
  _prev: AnnotationState,
  formData: FormData,
): Promise<AnnotationState> {
  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  // Editing a note clears the auto flag — the agency has taken ownership of it.
  const { error } = await supabase
    .from("trend_annotations")
    .update({ ...parsed.values, auto: false, updated_at: new Date().toISOString() })
    .eq("id", annotationId)
    .eq("client_id", clientId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { ok: true };
}

export async function deleteAnnotationAction(
  clientId: string,
  annotationId: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("trend_annotations")
    .delete()
    .eq("id", annotationId)
    .eq("client_id", clientId);
  revalidatePath(`/dashboard/clients/${clientId}`);
}
