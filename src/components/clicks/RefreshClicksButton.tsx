"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

/**
 * POC refresh: the Clicks report is fetched server-side with `no-store` on every
 * render, so re-running the server component (router.refresh) re-fetches from
 * Clicks. No DB write, no cron.
 */
export function RefreshClicksButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Refreshing…" : "Refresh from Clicks"}
    </Button>
  );
}
