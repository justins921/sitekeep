import { cn } from "@/lib/utils";

type Tone = "brand" | "green" | "orange" | "magenta" | "red" | "neutral";

const tones: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand border-brand-100",
  green: "bg-fill-green text-accent-green border-green-100",
  orange: "bg-orange-50 text-accent-orange border-orange-100",
  magenta: "bg-fill-pink text-accent-magenta border-pink-100",
  red: "bg-fill-red text-accent-red border-[color:#f4cccd]",
  neutral: "bg-canvas-alt text-muted border-line",
};

export function Badge({
  tone = "brand",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
