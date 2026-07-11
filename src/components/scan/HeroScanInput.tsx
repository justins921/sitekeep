"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";
import { normalizeUrl } from "@/lib/utils";

/** Landing-hero URL box: hands a valid URL to /scan, which runs the live scan. */
export function HeroScanInput() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError(true);
      return;
    }
    router.push(`/scan?url=${encodeURIComponent(normalized)}`);
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-8 max-w-lg">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(false);
          }}
          placeholder="yourclient.com"
          aria-label="Website to scan"
          autoComplete="url"
          className="w-full rounded-xl border border-line bg-surface px-4 py-3.5 text-sm text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <Button type="submit" size="lg" className="shrink-0 gap-2">
          Scan free <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted">
        {error ? (
          <span className="text-accent-red">Enter a valid address, like example.com.</span>
        ) : (
          "Free Keep Score in seconds — no signup, no credit card."
        )}
      </p>
    </form>
  );
}
