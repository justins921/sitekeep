"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

/**
 * Manual refresh: AI-visibility is fetched server-side on each render, so
 * re-running the server component (router.refresh) re-fetches from the source.
 * No cron here — the standalone provider's cadence is its own cron (Phase C).
 */
export function RefreshAiVisibilityButton({ label = "Refresh" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Refreshing…" : label}
    </Button>
  );
}
