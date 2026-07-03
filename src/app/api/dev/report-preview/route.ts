import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderReportEmail } from "@/lib/report-email";
import { periodLabel } from "@/lib/report-runner";
import type { ServiceType } from "@/lib/services";

export const runtime = "nodejs";

type PublicDashboard = {
  client: { company_name: string; website_url: string; logo_url: string | null };
  agency: { name: string; logo_url: string | null; brand_color: string };
  services: ServiceType[];
  metrics: Partial<Record<ServiceType, unknown>>;
};

/**
 * Dev-only: renders the report email HTML for a client slug so it can be
 * previewed in a browser or saved to a file. Returns 404 in production.
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_dashboard", {
    dashboard_slug: slug,
  });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const dash = data as PublicDashboard;
  const { html } = renderReportEmail({
    agency: dash.agency,
    client: dash.client,
    services: dash.services,
    metrics: dash.metrics,
    periodLabel: periodLabel("monthly", new Date()),
  });

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
