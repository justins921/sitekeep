"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "lucide-react";
import { importPendingSite } from "@/app/dashboard/onboarding-actions";

/**
 * Runs once on the first dashboard load after a scan-first signup: imports the
 * scanned site (server action reads + clears the pending-site cookie), then
 * refreshes so the new Keep Score card appears. Renders a quiet inline banner
 * while it works; nothing once done.
 */
export function AutoImportSite() {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      try {
        await importPendingSite();
      } finally {
        setDone(true);
        router.refresh();
      }
    })();
  }, [router]);

  if (done) return null;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3">
      <Loader className="h-4 w-4 animate-spin text-brand" />
      <p className="text-sm text-body">Importing the site you scanned…</p>
    </div>
  );
}
