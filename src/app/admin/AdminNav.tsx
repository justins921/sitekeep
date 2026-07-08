"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/agencies", label: "Agencies" },
  { href: "/admin/flags", label: "Feature flags" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {nav.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-xl px-3.5 py-2 text-sm font-medium transition-colors focus-ring",
              active
                ? "bg-brand-50 text-brand"
                : "text-body hover:bg-canvas-alt hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
