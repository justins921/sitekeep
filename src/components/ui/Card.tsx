import { cn } from "@/lib/utils";

type Tint = "white" | "blue" | "pink" | "green" | "violet";

const tints: Record<Tint, string> = {
  white: "bg-surface border-line",
  blue: "bg-fill-blue border-brand-100",
  pink: "bg-fill-pink border-pink-100",
  green: "bg-fill-green border-green-100",
  violet: "bg-fill-violet border-violet-100",
};

export function Card({
  tint = "white",
  hover = false,
  className,
  children,
  ...props
}: {
  tint?: Tint;
  hover?: boolean;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card-lg)] border shadow-soft",
        tints[tint],
        hover && "transition-shadow duration-200 hover:shadow-soft-md",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
