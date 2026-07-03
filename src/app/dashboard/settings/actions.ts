"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeHex } from "@/lib/color";

export type BrandingState = { error: string } | { ok: true } | null;

const BUCKET = "agency-logos";
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};

export async function updateBrandingAction(
  _prev: BrandingState,
  formData: FormData,
): Promise<BrandingState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: agency } = await supabase
    .from("agencies")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!agency) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Agency name is required." };

  const brand_color = normalizeHex(String(formData.get("brand_color") ?? ""));
  const alertRaw = String(formData.get("alert_email") ?? "").trim();

  const update: {
    name: string;
    brand_color: string;
    alert_email: string | null;
    logo_url?: string;
  } = {
    name,
    brand_color,
    alert_email: alertRaw || null,
  };

  // Optional logo upload.
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (!logo.type.startsWith("image/")) {
      return { error: "Logo must be an image file." };
    }
    if (logo.size > 2 * 1024 * 1024) {
      return { error: "Logo must be under 2 MB." };
    }
    const ext = EXT[logo.type] ?? "png";
    const path = `${agency.id}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, logo, { contentType: logo.type, upsert: true });
    if (uploadErr) return { error: `Logo upload failed: ${uploadErr.message}` };

    update.logo_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase
    .from("agencies")
    .update(update)
    .eq("id", agency.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}
