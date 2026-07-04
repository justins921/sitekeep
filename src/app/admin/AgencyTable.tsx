"use client";

import { Fragment, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { HealthBadge } from "@/components/metrics/HealthBadge";
import { SERVICE_META, type ServiceType } from "@/lib/services";
import type { AdminAgency } from "@/lib/admin";
import { viewAsAgencyAction } from "./actions";

type SortKey =
  | "name"
  | "owner_email"
  | "client_count"
  | "status"
  | "quantity"
  | "mrr"
  | "created_at"
  | "last_active";

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Agency" },
  { key: "owner_email", label: "Owner" },
  { key: "client_count", label: "Clients", numeric: true },
  { key: "status", label: "Status" },
  { key: "quantity", label: "Seats", numeric: true },
  { key: "mrr", label: "MRR", numeric: true },
  { key: "created_at", label: "Joined" },
  { key: "last_active", label: "Last active" },
];

const SUB_TONE: Record<string, string> = {
  active: "text-accent-green",
  trialing: "text-brand",
  past_due: "text-accent-orange",
  unpaid: "text-accent-magenta",
  canceled: "text-muted",
  inactive: "text-muted",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function compare(a: AdminAgency, b: AdminAgency, key: SortKey): number {
  const av = a[key] ?? "";
  const bv = b[key] ?? "";
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av).localeCompare(String(bv));
}

export function AgencyTable({ agencies }: { agencies: AdminAgency[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("mrr");
  const [asc, setAsc] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? agencies.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            (a.owner_email ?? "").toLowerCase().includes(q),
        )
      : agencies;
    const sorted = [...filtered].sort((a, b) => compare(a, b, sortKey));
    return asc ? sorted : sorted.reverse();
  }, [agencies, query, sortKey, asc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search agency or owner email…"
          className="w-full max-w-sm rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-100"
        />
        <span className="shrink-0 text-sm text-muted">
          {rows.length} of {agencies.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-card-lg)] border border-line bg-white shadow-soft">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="w-8" />
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-3 py-3 font-semibold text-muted",
                    c.numeric && "text-right",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className="inline-flex items-center gap-1 hover:text-ink"
                  >
                    {c.label}
                    <span className="text-[10px]">
                      {sortKey === c.key ? (asc ? "▲" : "▼") : ""}
                    </span>
                  </button>
                </th>
              ))}
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="px-3 py-8 text-center text-muted">
                  No agencies match.
                </td>
              </tr>
            )}
            {rows.map((a) => {
              const open = expanded === a.id;
              return (
                <Fragment key={a.id}>
                  <tr
                    className={cn(
                      "cursor-pointer border-b border-line transition-colors hover:bg-canvas-alt",
                      open && "bg-canvas-alt",
                    )}
                    onClick={() => setExpanded(open ? null : a.id)}
                  >
                    <td className="pl-3 text-muted">{open ? "▾" : "▸"}</td>
                    <td className="px-3 py-3 font-semibold text-ink">{a.name}</td>
                    <td className="px-3 py-3 text-muted">{a.owner_email ?? "—"}</td>
                    <td className="px-3 py-3 text-right">
                      {a.active_client_count}
                      <span className="text-muted">/{a.client_count}</span>
                    </td>
                    <td className={cn("px-3 py-3 font-medium", SUB_TONE[a.status] ?? "text-muted")}>
                      {a.status}
                    </td>
                    <td className="px-3 py-3 text-right">{a.quantity}</td>
                    <td className="px-3 py-3 text-right font-medium text-ink">${a.mrr}</td>
                    <td className="px-3 py-3 text-muted">{fmtDate(a.created_at)}</td>
                    <td className="px-3 py-3 text-muted">{fmtDate(a.last_active)}</td>
                    <td className="px-3 py-3">
                      <form action={viewAsAgencyAction.bind(null, a.id)}>
                        <button
                          type="submit"
                          onClick={(e) => e.stopPropagation()}
                          className="whitespace-nowrap rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-body transition-colors hover:border-brand hover:text-brand"
                        >
                          View as
                        </button>
                      </form>
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-line bg-canvas-alt/50">
                      <td colSpan={COLUMNS.length + 2} className="px-6 py-4">
                        <AgencyDetail agency={a} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AgencyDetail({ agency }: { agency: AdminAgency }) {
  if (agency.clients.length === 0) {
    return <p className="text-sm text-muted">No clients yet.</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Clients ({agency.clients.length})
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {agency.clients.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-white p-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-ink">
                  {c.company_name}
                </span>
                {!c.is_active && (
                  <span className="rounded-full bg-canvas-alt px-1.5 py-0.5 text-[10px] font-medium text-muted">
                    Paused
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {c.services.length > 0
                  ? c.services.map((s) => SERVICE_META[s as ServiceType]?.label ?? s).join(" · ")
                  : "No services"}
              </p>
              <p className="text-xs text-faint">
                Refreshed {c.last_refresh ? fmtDate(c.last_refresh) : "never"}
              </p>
            </div>
            <HealthBadge score={c.health} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
