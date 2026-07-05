"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, Spark } from "@/components/ui";

const CLIENTS = { href: "/dashboard", label: "Clients", exact: true, icon: "◧" };
const BRANDING = { href: "/dashboard/settings", label: "Branding", exact: false, icon: "◑" };
const TEAM = { href: "/dashboard/team", label: "Team", exact: false, icon: "◍" };
const BILLING = { href: "/dashboard/billing", label: "Billing", exact: false, icon: "◈" };

export function Sidebar({
  agencyName,
  userEmail,
  role = "owner",
  isSuperAdmin = false,
  viewingAs = null,
}: {
  agencyName: string;
  userEmail: string;
  role?: "owner" | "member";
  isSuperAdmin?: boolean;
  viewingAs?: string | null;
}) {
  const pathname = usePathname();

  // While impersonating, show only Clients (the rest are the admin's own and
  // would mismatch the agency being viewed). Otherwise everyone sees Clients /
  // Branding / Team; Billing is owner-only. The /admin entry is rendered
  // server-side only for super-admins — never a client-side hide.
  const nav = viewingAs
    ? [CLIENTS]
    : role === "owner"
      ? [CLIENTS, BRANDING, TEAM, BILLING]
      : [CLIENTS, BRANDING, TEAM];

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-white">
      <div className="px-5 py-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 font-bold text-ink">
          <Spark className="text-brand" />
          <span className="text-lg tracking-tight">SiteKeep</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand"
                  : "text-body hover:bg-canvas-alt hover:text-ink",
              )}
            >
              <span className="text-base leading-none opacity-70">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        {isSuperAdmin && !viewingAs && (
          <Link
            href="/admin"
            className={cn(
              "mt-2 flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm font-medium transition-colors",
              pathname.startsWith("/admin")
                ? "bg-brand-50 text-brand"
                : "text-body hover:bg-canvas-alt hover:text-ink",
            )}
          >
            <span className="text-base leading-none opacity-70">⬡</span>
            Admin
          </Link>
        )}
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={agencyName} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{agencyName}</p>
            <p className="truncate text-xs text-muted">{userEmail}</p>
          </div>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-muted transition-colors hover:bg-canvas-alt hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
