import { cn } from "@/lib/utils";
import { healthBand, HEALTH_BAND_META } from "@/lib/health";

/**
 * Colored health pill — a dot + the 0–100 score. Shared by the agency client
 * list, the admin agency detail, and the admin grid so the red/yellow/green
 * banding reads identically everywhere. Renders a neutral "—" when unscored.
 */
export function HealthBadge({
  score,
  size = "md",
  showLabel = false,
  className,
}: {
  score: number | null | undefined;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}) {
  const band = healthBand(score);
  const meta = HEALTH_BAND_META[band];
  const scored = band !== "none";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        "border-line bg-surface",
        className,
      )}
      title={meta.label}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: meta.dot }}
      />
      <span className={meta.text}>{scored ? Math.round(score as number) : "—"}</span>
      {showLabel && <span className="font-medium text-muted">{meta.label}</span>}
    </span>
  );
}
