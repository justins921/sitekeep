import { Card } from "@/components/ui";

/** Temporary stand-in for routes built out in later phases. */
export function Placeholder({
  title,
  phase,
  children,
}: {
  title: string;
  phase: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <Card className="mt-8 p-8">
        <p className="text-sm text-muted">
          {children ?? "This section is coming up."} —{" "}
          <span className="font-medium text-brand">{phase}</span>
        </p>
      </Card>
    </div>
  );
}
