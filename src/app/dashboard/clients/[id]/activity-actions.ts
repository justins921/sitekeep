"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_CATEGORIES, type ActivityCategory } from "@/lib/activity";

export type ActivityActionResult = { error: string } | null;

type Input = {
  title: string;
  description: string;
  category: string;
  performed_at: string; // YYYY-MM-DD or ""
};

async function requireUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
}

function normalize(input: Input): { error: string } | {
  title: string;
  description: string | null;
  category: ActivityCategory | null;
  performed_at: string;
} {
  const title = input.title.trim();
  if (!title) return { error: "A title is required." };
  const category = ACTIVITY_CATEGORIES.includes(input.category as ActivityCategory)
    ? (input.category as ActivityCategory)
    : null;
  // Interpret a date-only value at noon UTC to avoid timezone drift.
  const performed_at = input.performed_at
    ? new Date(`${input.performed_at}T12:00:00Z`).toISOString()
    : new Date().toISOString();
  return {
    title,
    description: input.description.trim() || null,
    category,
    performed_at,
  };
}

export async function addActivityAction(
  clientId: string,
  input: Input,
): Promise<ActivityActionResult> {
  const parsed = normalize(input);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  await requireUser(supabase);

  const { data: client } = await supabase
    .from("clients")
    .select("agency_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client?.agency_id) return { error: "Client not found." };

  const { error } = await supabase.from("activity_log").insert({
    client_id: clientId,
    agency_id: client.agency_id as string,
    ...parsed,
  });
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/clients/${clientId}`);
  return null;
}

export async function updateActivityAction(
  clientId: string,
  activityId: string,
  input: Input,
): Promise<ActivityActionResult> {
  const parsed = normalize(input);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  await requireUser(supabase);

  // RLS scopes the update to the owning agency.
  const { error } = await supabase
    .from("activity_log")
    .update(parsed)
    .eq("id", activityId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/clients/${clientId}`);
  return null;
}

export async function deleteActivityAction(
  clientId: string,
  activityId: string,
): Promise<ActivityActionResult> {
  const supabase = await createClient();
  await requireUser(supabase);

  const { error } = await supabase.from("activity_log").delete().eq("id", activityId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/clients/${clientId}`);
  return null;
}
