"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Per-client tab nav: Dashboard (the client-facing view) / Manage (agency-only
 * activity, requests, incidents) / Settings (services, integrations, report,
 * edit, delete). Collapses to just Dashboard in read-only "view as" mode.
 */
export function ClientTabs({ id, readOnly }: { id: string; readOnly: boolean }) {
  const pathname = usePathname();
  const base = `/dashboard/clients/${id}`;

  const tabs = readOnly
    ? [{ href: base, label: "Dashboard", match: (p: string) => p === base }]
    : [
        { href: base, label: "Dashboard", match: (p: string) => p === base },
        {
          href: `${base}/manage`,
          label: "Manage",
          match: (p: string) => p.startsWith(`${base}/manage`),
        },
        {
          href: `${base}/settings`,
          label: "Settings",
          match: (p: string) =>
            p.startsWith(`${base}/settings`) || p.startsWith(`${base}/edit`),
        },
      ];

  return (
    <nav className="mt-6 flex gap-1 border-b border-line">
      {tabs.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
