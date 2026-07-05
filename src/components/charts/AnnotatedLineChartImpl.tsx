"use client";

import {
  CartesianGrid,
  Line,
  LineChart as RLineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type AnnoMarker = {
  t: number; // ms
  label: string;
  description: string | null;
  icon: string;
  color: string;
};

export type AnnotatedLineChartProps = {
  points: { t: number; v: number }[];
  annotations: AnnoMarker[];
  color?: string;
  height?: number;
  unit?: string;
  digits?: number;
};

/**
 * Time-axis line chart with vertical annotation markers. The x-axis is a real
 * time scale (ms), so annotation ReferenceLines land on their true date. Each
 * marker carries a native <title> for hover reveal; the list below the chart
 * gives the full label + description. Lazy-loaded via AnnotatedLineChart.
 */
export default function AnnotatedLineChartImpl({
  points,
  annotations,
  color = "#0068ff",
  height = 150,
  unit = "",
  digits = 0,
}: AnnotatedLineChartProps) {
  const fmt = (t: number) =>
    new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RLineChart data={points} margin={{ top: 14, right: 8, bottom: 4, left: -18 }}>
        <CartesianGrid stroke="#eeeeee" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={fmt}
          tick={{ fontSize: 11, fill: "#646464" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e5e5" }}
          minTickGap={28}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#646464" }}
          tickLine={false}
          axisLine={false}
          width={44}
          allowDecimals={digits > 0}
        />
        <Tooltip
          labelFormatter={(t) => fmt(Number(t))}
          formatter={(val) => [`${Number(val).toFixed(digits)}${unit}`, "Value"]}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e5e5e5",
            fontSize: 12,
            boxShadow: "0 6px 20px rgba(14,33,61,0.08)",
          }}
        />
        {annotations.map((a, i) => (
          <ReferenceLine
            key={i}
            x={a.t}
            stroke={a.color}
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={(props: { viewBox?: { x?: number; y?: number } }) => {
              const cx = props.viewBox?.x ?? 0;
              const cy = (props.viewBox?.y ?? 0) + 1;
              return (
                <g>
                  <title>
                    {a.label}
                    {a.description ? ` — ${a.description}` : ""}
                  </title>
                  <circle cx={cx} cy={cy} r={7} fill="#ffffff" stroke={a.color} strokeWidth={1.5} />
                  <text x={cx} y={cy + 3} textAnchor="middle" fontSize={9} fill={a.color}>
                    {a.icon}
                  </text>
                </g>
              );
            }}
          />
        ))}
        <Line
          type="monotone"
          dataKey="v"
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
