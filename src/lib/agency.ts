import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Agency = {
  id: string;
  owner_id: string;
  name: string;
  logo_url: string | null;
  brand_color: string;
  alert_email: string | null;
  created_at: string;
};

/**
 * Returns the signed-in user's agency, redirecting to /login if there is no
 * session. The agency row is auto-created by a DB trigger on signup, so an
 * authenticated user always has exactly one.
 */
export async function requireAgency(): Promise<{
  agency: Agency;
  userEmail: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: agency } = await supabase
    .from("agencies")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!agency) redirect("/login");

  return { agency: agency as Agency, userEmail: user.email ?? "" };
}
