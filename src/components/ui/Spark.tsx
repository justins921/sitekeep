import { cn } from "@/lib/utils";

/** Playful four-point "impulse" spark used near primary CTAs and headings. */
export function Spark({
  className,
  color = "currentColor",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-5 w-5", className)} fill="none" aria-hidden>
      <path
        d="M12 2c.4 4.6 1.4 5.6 6 6-4.6.4-5.6 1.4-6 6-.4-4.6-1.4-5.6-6-6 4.6-.4 5.6-1.4 6-6z"
        fill={color}
      />
    </svg>
  );
}
