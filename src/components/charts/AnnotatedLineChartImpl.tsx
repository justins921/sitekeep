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
  color = "#4c8dff",
  height = 150,
  unit = "",
  digits = 0,
}: AnnotatedLineChartProps) {
  const fmt = (t: number) =>
    new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RLineChart data={points} margin={{ top: 14, right: 8, bottom: 4, left: -18 }}>
        <CartesianGrid stroke="#26303a" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={fmt}
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
          allowDecimals={digits > 0}
        />
        <Tooltip
          labelFormatter={(t) => fmt(Number(t))}
          formatter={(val) => [`${Number(val).toFixed(digits)}${unit}`, "Value"]}
          contentStyle={{ background: "#141b22", color: "#e6edf3",
            borderRadius: 12,
            border: "1px solid #2a3742",
            fontSize: 12,
            boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
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
                  <circle cx={cx} cy={cy} r={7} fill="#141b22" stroke={a.color} strokeWidth={1.5} />
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
