"use client";

import dynamic from "next/dynamic";
import type { AnnotatedLineChartProps } from "./AnnotatedLineChartImpl";

// Lazy-load Recharts on the client only, so it never lands in the initial
// bundle. A lightweight skeleton holds the space while it loads.
const Impl = dynamic(() => import("./AnnotatedLineChartImpl"), {
  ssr: false,
  loading: () => <div className="h-[150px] w-full animate-pulse rounded-xl bg-canvas-alt" />,
});

export function AnnotatedLineChart(props: AnnotatedLineChartProps) {
  return <Impl {...props} />;
}
