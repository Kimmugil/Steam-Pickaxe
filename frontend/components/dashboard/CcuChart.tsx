"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useMemo, useRef, useEffect, useState } from "react";
import type { CcuRow } from "@/types";

interface CcuChartProps {
  data: CcuRow[];
  peaktimeComment?: string;
}

interface SampledPoint {
  ts: string;
  label: string;
  value: number;
}

function bucketKey(date: Date, isRecent: boolean): string {
  const d = new Date(date);
  if (isRecent) {
    d.setHours(Math.floor(d.getHours() / 4) * 4, 0, 0, 0);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d.toISOString();
}

function formatLabel(iso: string, isRecent: boolean): string {
  try {
    const d = new Date(iso);
    const m = d.getMonth() + 1;
    const day = d.getDate();
    if (!isRecent) return `${m}/${day}`;
    const h = d.getHours();
    return h === 0 ? `${m}/${day}` : `${h}시`;
  } catch {
    return iso;
  }
}

export default function CcuChart({ data, peaktimeComment }: CcuChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(800);

  const resampled = useMemo<SampledPoint[]>(() => {
    if (!data.length) return [];
    const now = Date.now();
    const cutoff30d = now - 30 * 24 * 3600 * 1000;

    const buckets = new Map<string, { values: number[]; isRecent: boolean }>();

    for (const row of data) {
      const ts = new Date(row.timestamp).getTime();
      if (isNaN(ts)) continue;
      const isRecent = ts >= cutoff30d;
      const key = bucketKey(new Date(ts), isRecent);
      if (!buckets.has(key)) {
        buckets.set(key, { values: [], isRecent });
      }
      const b = buckets.get(key)!;
      const v = Number(row.ccu_value);
      if (!isNaN(v)) b.values.push(v);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ts, b]) => ({
        ts,
        label: formatLabel(ts, b.isRecent),
        value: b.values.length ? Math.round(b.values.reduce((s, v) => s + v, 0) / b.values.length) : 0,
      }));
  }, [data]);

  const PX_PER_POINT = 10;
  const chartWidth = Math.max(containerW, resampled.length * PX_PER_POINT);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setContainerW(el.clientWidth);
    el.scrollLeft = el.scrollWidth;
  }, [resampled]);

  const tickInterval = Math.max(1, Math.floor(resampled.length / 30));

  if (!resampled.length) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        CCU 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-3 text-xs">
        <span className="text-text-muted">← 스크롤로 이전 데이터 확인 · 최근 30일 기준</span>
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-auto"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div style={{ width: chartWidth, height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={resampled} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#8b91a8", fontSize: 10 }}
                interval={tickInterval}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#8b91a8", fontSize: 11 }}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{ background: "#1e2130", border: "1px solid #2a2f45", borderRadius: 8, color: "#e8eaf0" }}
                formatter={(v: number) => [`${v.toLocaleString()}명`, "CCU"]}
                labelFormatter={(label) => String(label)}
              />
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
        </div>
      </div>

      {peaktimeComment && (
        <div className="mt-4 bg-bg-card border border-accent-blue/20 rounded-lg px-4 py-3">
          <p className="text-xs text-accent-blue mb-1">AI 피크타임 분석</p>
          <p className="text-sm text-text-secondary leading-relaxed">{peaktimeComment}</p>
        </div>
      )}
    </div>
  );
}
