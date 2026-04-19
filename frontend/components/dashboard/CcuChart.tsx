"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea,
} from "recharts";
import { useMemo } from "react";
import type { CcuRow } from "@/types";

interface CcuChartProps {
  data: CcuRow[];
  peaktimeComment?: string;
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}시`;
  } catch {
    return ts;
  }
}

export default function CcuChart({ data, peaktimeComment }: CcuChartProps) {
  const filtered = useMemo(() => {
    return data.map((row) => ({
      ts: row.timestamp,
      label: formatTimestamp(row.timestamp),
      value: Number(row.ccu_value),
      isSale: row.is_sale_period === "TRUE" || row.is_sale_period === true,
      isFreeWeekend: row.is_free_weekend === "TRUE" || row.is_free_weekend === true,
    }));
  }, [data]);

  // 판매 구간 ReferenceArea 계산
  const saleRanges = useMemo(() => {
    const ranges: { start: string; end: string; type: "sale" | "freeweekend" }[] = [];
    let current: typeof ranges[0] | null = null;
    for (const d of filtered) {
      if (d.isFreeWeekend) {
        if (!current || current.type !== "freeweekend") {
          if (current) ranges.push(current);
          current = { start: d.label, end: d.label, type: "freeweekend" };
        } else current.end = d.label;
      } else if (d.isSale) {
        if (!current || current.type !== "sale") {
          if (current) ranges.push(current);
          current = { start: d.label, end: d.label, type: "sale" };
        } else current.end = d.label;
      } else {
        if (current) { ranges.push(current); current = null; }
      }
    }
    if (current) ranges.push(current);
    return ranges;
  }, [filtered]);

  return (
    <div>
      {/* 범례 */}
      <div className="flex gap-4 mb-3 text-xs flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-3 h-1.5 bg-accent-orange/50 rounded inline-block" />할인 기간
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-1.5 bg-accent-green/50 rounded inline-block" />무료 주말
        </span>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={filtered} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#8b91a8", fontSize: 11 }}
            interval="preserveStartEnd"
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#8b91a8", fontSize: 11 }}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ background: "#1e2130", border: "1px solid #2a2f45", borderRadius: 8, color: "#e8eaf0" }}
            formatter={(v: number) => [`${v.toLocaleString()}명`, "CCU"]}
          />

          {saleRanges.map((r, i) => (
            <ReferenceArea
              key={i}
              x1={r.start}
              x2={r.end}
              fill={r.type === "freeweekend" ? "#5db86520" : "#e08c4520"}
              strokeOpacity={0}
            />
          ))}

          <Line
            type="monotone"
            dataKey="value"
            stroke="#4f87ff"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {peaktimeComment && (
        <div className="mt-4 bg-bg-card border border-accent-blue/20 rounded-lg px-4 py-3">
          <p className="text-xs text-accent-blue mb-1">AI 피크타임 분석</p>
          <p className="text-sm text-text-secondary leading-relaxed">{peaktimeComment}</p>
        </div>
      )}
    </div>
  );
}
