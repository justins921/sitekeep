"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin, VIEW_AS_COOKIE } from "@/lib/view-context";

// "View as agency" support flow. Only a super-admin can set the impersonation
// cookie, and only for an agency that actually exists (verified through the
// super-admin SELECT policy). The cookie is httpOnly so it can't be forged from
// client JS; the dashboard reads it server-side via getViewContext().

export async function viewAsAgencyAction(agencyId: string): Promise<void> {
  const supabase = await createClient();
  if (!(await isSuperAdmin(supabase))) redirect("/dashboard");

  const { data } = await supabase
    .from("agencies")
    .select("id")
    .eq("id", agencyId)
    .maybeSingle();
  if (!data) redirect("/admin/agencies");

  const store = await cookies();
  store.set(VIEW_AS_COOKIE, agencyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4, // 4h — a support session, not a standing grant
  });
  redirect("/dashboard");
}

export async function exitViewAsAction(): Promise<void> {
  const store = await cookies();
  store.delete(VIEW_AS_COOKIE);
  redirect("/admin/agencies");
}
