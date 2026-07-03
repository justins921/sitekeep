"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import {
  createCheckoutSession,
  createPortalSession,
  type BillingActionResult,
} from "./actions";

export function BillingButtons({
  subscribed,
  canManage,
}: {
  subscribed: boolean;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<BillingActionResult>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if ("url" in res) window.location.href = res.url;
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {!subscribed && (
          <Button onClick={() => run(createCheckoutSession)} disabled={pending}>
            {pending ? "Starting…" : "Subscribe"}
          </Button>
        )}
        {canManage && (
          <Button
            variant="secondary"
            onClick={() => run(createPortalSession)}
            disabled={pending}
          >
            Manage billing
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-accent-magenta">{error}</p>}
    </div>
  );
}
