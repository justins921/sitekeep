"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { deleteClientAction } from "../actions";

export function DeleteClientButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        Delete
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted">Delete {clientName}?</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(false)}
        disabled={pending}
      >
        Cancel
      </Button>
      <Button
        size="sm"
        className="!bg-accent-magenta hover:!bg-accent-magenta/90"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await deleteClientAction(clientId);
          })
        }
      >
        {pending ? "Deleting…" : "Confirm delete"}
      </Button>
    </div>
  );
}
