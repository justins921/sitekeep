"use client";

import { useActionState, useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { normalizeHex, readableText, safeAccent } from "@/lib/color";
import { updateBrandingAction, type BrandingState } from "./actions";

const inputClass =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand/20";

export function SettingsForm({
  defaults,
  ownerEmail,
}: {
  defaults: {
    name: string;
    brand_color: string;
    logo_url: string | null;
    alert_email: string | null;
  };
  ownerEmail: string;
}) {
  const [state, formAction, pending] = useActionState<BrandingState, FormData>(
    updateBrandingAction,
    null,
  );

  const [name, setName] = useState(defaults.name);
  const [color, setColor] = useState(normalizeHex(defaults.brand_color));
  const [logoPreview, setLogoPreview] = useState<string | null>(defaults.logo_url);

  // Revoke object URLs we create for local file previews.
  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setLogoPreview(URL.createObjectURL(file));
  };

  const headerText = readableText(color);
  const accent = safeAccent(color);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <form action={formAction} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-sm font-medium text-ink">
            Agency name
          </label>
          <input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="brand_color" className="text-sm font-medium text-ink">
            Brand color
          </label>
          <div className="flex items-center gap-3">
            <input
              id="brand_color"
              name="brand_color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-white p-1"
            />
            <input
              aria-label="Brand color hex"
              value={color}
              onChange={(e) => setColor(normalizeHex(e.target.value))}
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="alert_email" className="text-sm font-medium text-ink">
            Alert email <span className="text-faint">(optional)</span>
          </label>
          <input
            id="alert_email"
            name="alert_email"
            type="email"
            defaultValue={defaults.alert_email ?? ""}
            placeholder={ownerEmail}
            className={inputClass}
          />
          <p className="text-xs text-muted">
            Where downtime &amp; SSL-expiry alerts are sent. Defaults to your
            login email ({ownerEmail}).
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="logo" className="text-sm font-medium text-ink">
            Logo <span className="text-faint">(PNG/SVG, under 2 MB)</span>
          </label>
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/*"
            onChange={onFile}
            className="block w-full text-sm text-body file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:bg-brand-100"
          />
        </div>

        {state && "error" in state && (
          <p className="rounded-xl bg-fill-pink px-4 py-3 text-sm text-accent-magenta">
            {state.error}
          </p>
        )}
        {state && "ok" in state && (
          <p className="rounded-xl bg-fill-green px-4 py-3 text-sm text-accent-green">
            Branding saved. Your public dashboards are updated.
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save branding"}
        </Button>
      </form>

      {/* Live preview */}
      <div>
        <p className="mb-2 text-sm font-medium text-muted">Live preview</p>
        <Card className="overflow-hidden p-0">
          <div
            className="flex items-center gap-3 px-5 py-6"
            style={{ backgroundColor: color, color: headerText }}
          >
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreview}
                alt="Logo preview"
                className="h-9 w-9 rounded-lg bg-white/90 object-contain p-1"
              />
            ) : (
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 text-sm font-bold"
                style={{ color: headerText }}
              >
                {name.slice(0, 1).toUpperCase() || "A"}
              </span>
            )}
            <span className="text-sm font-semibold opacity-90">
              {name || "Your Agency"}
            </span>
          </div>
          <div className="space-y-3 p-5">
            <p className="text-lg font-bold text-ink">Client Company</p>
            <div className="h-2 w-24 rounded-full" style={{ backgroundColor: accent }} />
            <a className="text-sm font-medium" style={{ color: accent }}>
              example.com
            </a>
          </div>
        </Card>
        <p className="mt-3 text-xs text-muted">
          This is how the header of every client&apos;s public dashboard will look.
        </p>
      </div>
    </div>
  );
}
