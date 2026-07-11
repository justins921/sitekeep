"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { variantsFor } from "@/lib/features-meta";
import { setAgencyFlagAction } from "../actions";

export type BoardAgency = { id: string; name: string; owner_email: string | null };
export type BoardFlag = {
  key: string;
  description: string | null;
  defaultVariant: string;
  defaultEnabled: boolean;
};

const VARIANT_LABEL: Record<string, string> = {
  off: "Off",
  standalone: "Standalone",
  clicks: "Clicks",
};

function VariantSelect({
  agencyId,
  flagKey,
  value,
}: {
  agencyId: string;
  flagKey: string;
  value: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const options = variantsFor(flagKey);

  function onChange(next: string) {
    if (next === value) return;
    setError(null);
    startTransition(async () => {
      const r = await setAgencyFlagAction(agencyId, flagKey, next);
      if (!r.ok) setError(r.error ?? "Failed");
      router.refresh();
    });
  }

  const enabled = value !== "off";
  return (
    <div className="flex items-center gap-2">
      <span
        className={
          "inline-block h-2 w-2 rounded-full " + (enabled ? "bg-accent-green" : "bg-faint")
        }
        title={enabled ? "Enabled" : "Disabled"}
      />
      <select
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-medium text-ink focus:border-brand focus:outline-none disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {VARIANT_LABEL[o] ?? o}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-accent-red">{error}</span>}
    </div>
  );
}

export function FlagsBoard({
  agencies,
  flags,
  effective,
}: {
  agencies: BoardAgency[];
  flags: BoardFlag[];
  effective: Record<string, string>;
}) {
  if (agencies.length === 0) {
    return <Card className="p-6 text-sm text-muted">No agencies yet.</Card>;
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas-alt">
              <th className="px-5 py-3 font-semibold text-ink">Agency</th>
              {flags.map((f) => (
                <th key={f.key} className="px-5 py-3 font-semibold text-ink">
                  <div>{f.key}</div>
                  <div className="text-xs font-normal text-muted">
                    default: {f.defaultVariant}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agencies.map((a) => (
              <tr key={a.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">
                  <div className="font-medium text-ink">{a.name}</div>
                  {a.owner_email && (
                    <div className="text-xs text-muted">{a.owner_email}</div>
                  )}
                </td>
                {flags.map((f) => (
                  <td key={f.key} className="px-5 py-3">
                    <VariantSelect
                      agencyId={a.id}
                      flagKey={f.key}
                      value={effective[`${a.id}:${f.key}`] ?? f.defaultVariant}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
