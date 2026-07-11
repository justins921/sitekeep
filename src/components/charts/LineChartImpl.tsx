"use client";

import {
  CartesianGrid,
  Line,
  LineChart as RLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type LineChartProps = {
  current: number[];
  preceding?: number[];
  dates?: string[]; // labels for the current series (x-axis)
  color?: string;
  height?: number;
  currentLabel?: string;
  precedingLabel?: string;
};

/**
 * Current-period (solid brand) vs preceding-period (dashed grey) overlay,
 * index-aligned so the two windows compare day-for-day. Recharts; loaded lazily
 * via the LineChart wrapper so it never ships in the initial bundle.
 */
export default function LineChartImpl({
  current,
  preceding = [],
  dates = [],
  color = "#0068ff",
  height = 220,
  currentLabel = "Current",
  precedingLabel = "Preceding",
}: LineChartProps) {
  const n = Math.max(current.length, preceding.length);
  const data = Array.from({ length: n }, (_, i) => ({
    i,
    label: dates[i] ?? `Day ${i + 1}`,
    current: current[i] ?? null,
    preceding: preceding[i] ?? null,
  }));

  const fmtDate = (v: string) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? v
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RLineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
        <CartesianGrid stroke="#26303a" vertical={false} />
        <XAxis
          dataKey="label"
          tickFormatter={fmtDate}
          tick={{ fontSize: 11, fill: "#8b98a5" }}
          tickLine={false}
          axisLine={{ stroke: "#2a3742" }}
          minTickGap={28}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#8b98a5" }}
          tickLine={false}
          axisLine={false}
          width={44}
          allowDecimals={false}
        />
        <Tooltip
          labelFormatter={(v) => fmtDate(String(v))}
          contentStyle={{ background: "#141b22", color: "#e6edf3",
            borderRadius: 12,
            border: "1px solid #2a3742",
            fontSize: 12,
            boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
          }}
          formatter={(value, name) => [
            value ?? "",
            name === "current" ? currentLabel : precedingLabel,
          ]}
        />
        {preceding.length > 0 && (
          <Line
            type="monotone"
            dataKey="preceding"
            stroke="#b8b8b8"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        )}
        <Line
          type="monotone"
          dataKey="current"
          stroke={color}
          strokeWidth={2.5}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </RLineChart>
    </ResponsiveContainer>
  );
}
