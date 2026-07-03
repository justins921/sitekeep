import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 renamed the Middleware convention to Proxy. Same functionality:
// this runs before every matched request to refresh the Supabase session
// cookie and enforce the /dashboard auth boundary.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on all paths except static assets, images, and the Stripe webhook
     * (which must receive its raw, untouched body for signature verification).
     */
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
