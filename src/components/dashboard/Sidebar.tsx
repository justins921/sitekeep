"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, Spark } from "@/components/ui";

const CLIENTS = { href: "/dashboard", label: "Clients", exact: true, icon: "◧" };
const BRANDING = { href: "/dashboard/settings", label: "Branding", exact: false, icon: "◑" };
const TEAM = { href: "/dashboard/team", label: "Team", exact: false, icon: "◍" };
const BILLING = { href: "/dashboard/billing", label: "Billing", exact: false, icon: "◈" };

type NavItem = { href: string; label: string; exact: boolean; icon: string };

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
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // While impersonating, show only Clients (the rest are the admin's own and
  // would mismatch the agency being viewed). Otherwise everyone sees Clients /
  // Branding / Team; Billing is owner-only. The /admin entry is rendered
  // server-side only for super-admins — never a client-side hide.
  const nav: NavItem[] = viewingAs
    ? [CLIENTS]
    : role === "owner"
      ? [CLIENTS, BRANDING, TEAM, BILLING]
      : [CLIENTS, BRANDING, TEAM];

  const navLinks = (
    <>
      {nav.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={close}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-brand-50 text-brand" : "text-body hover:bg-canvas-alt hover:text-ink",
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
          onClick={close}
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
    </>
  );

  const footer = (
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
  );

  const brand = (
    <Link
      href="/dashboard"
      onClick={close}
      className="inline-flex items-center gap-2 font-bold text-ink"
    >
      <Spark className="text-brand" />
      <span className="text-lg tracking-tight">SiteKeep</span>
    </Link>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-white lg:flex">
        <div className="px-5 py-6">{brand}</div>
        <nav className="flex-1 space-y-1 px-3">{navLinks}</nav>
        {footer}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white px-4 py-3 lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-ink hover:bg-canvas-alt"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[82%] flex-col bg-white shadow-soft-md">
            <div className="flex items-center justify-between px-5 py-4">
              {brand}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-ink hover:bg-canvas-alt"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3">{navLinks}</nav>
            {footer}
          </div>
        </div>
      )}
    </>
  );
}
