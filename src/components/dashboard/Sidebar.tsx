"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, Spark } from "@/components/ui";

const baseNav = [
  { href: "/dashboard", label: "Clients", exact: true, icon: "◧" },
  { href: "/dashboard/settings", label: "Branding", icon: "◑" },
  { href: "/dashboard/billing", label: "Billing", icon: "◈" },
];

export function Sidebar({
  agencyName,
  userEmail,
  isSuperAdmin = false,
  viewingAs = null,
}: {
  agencyName: string;
  userEmail: string;
  isSuperAdmin?: boolean;
  viewingAs?: string | null;
}) {
  const pathname = usePathname();

  // While impersonating, show only Clients (Branding/Billing are the admin's own
  // and would mismatch the agency being viewed). The /admin entry is rendered
  // server-side only for super-admins — never a client-side hide.
  const nav = viewingAs ? baseNav.slice(0, 1) : baseNav;

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
