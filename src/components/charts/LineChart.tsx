"use client";

import dynamic from "next/dynamic";
import type { LineChartProps } from "./LineChartImpl";

// Lazy-load Recharts on the client only, so it never lands in the initial
// bundle. A lightweight skeleton holds the space while it loads.
const Impl = dynamic(() => import("./LineChartImpl"), {
  ssr: false,
  loading: () => <div className="h-[220px] w-full animate-pulse rounded-xl bg-canvas-alt" />,
});

export function LineChart(props: LineChartProps) {
  return <Impl {...props} />;
}

/** Legend row for the comparison chart. */
export function ComparisonLegend({
  color,
  currentLabel,
  precedingLabel,
}: {
  color: string;
  currentLabel: string;
  precedingLabel: string;
}) {
  return (
    <div className="flex items-center gap-4 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-5 rounded" style={{ backgroundColor: color }} />
        {currentLabel}
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-0 w-5 border-t-2 border-dashed"
          style={{ borderColor: "#b8b8b8" }}
        />
        {precedingLabel}
      </span>
    </div>
  );
}
