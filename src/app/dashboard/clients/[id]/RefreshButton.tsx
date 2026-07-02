"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { SERVICE_META } from "@/lib/services";
import { refreshMetricsAction, type RefreshResult } from "../actions";

export function RefreshButton({
  clientId,
  hasEnabled,
}: {
  clientId: string;
  hasEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RefreshResult | null>(null);

  function refresh() {
    setResult(null);
    startTransition(async () => {
      const r = await refreshMetricsAction(clientId);
      setResult(r);
      router.refresh(); // re-render server components with the new snapshots
    });
  }

  const failures = result?.results.filter((r) => !r.ok) ?? [];

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={refresh} disabled={pending || !hasEnabled} size="sm">
        {pending ? "Refreshing…" : "Refresh metrics"}
      </Button>
      {result && failures.length === 0 && result.ran && (
        <span className="text-xs text-accent-green">Updated just now</span>
      )}
      {failures.map((f) => (
        <span key={f.service_type} className="text-xs text-accent-magenta">
          {SERVICE_META[f.service_type].label}: {f.error}
        </span>
      ))}
    </div>
  );
}
