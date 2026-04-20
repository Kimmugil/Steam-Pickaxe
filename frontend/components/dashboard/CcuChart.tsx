"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea,
} from "recharts";
import { useMemo, useRef, useEffect, useState } from "react";
import type { CcuRow } from "@/types";

interface CcuChartProps {
  data: CcuRow[];
  peaktimeComment?: string;
}

interface SampledPoint {
  ts: string;      // ISO bucket key (for sorting)
  label: string;   // display label
  value: number;
  isSale: boolean;
  isFreeWeekend: boolean;
}

function bucketKey(date: Date, isRecent: boolean): string {
  const d = new Date(date);
  if (isRecent) {
    // 4h bucket
    d.setHours(Math.floor(d.getHours() / 4) * 4, 0, 0, 0);
  } else {
    // daily bucket
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

  // Resample: last 30 days → 4h buckets, older → daily buckets
  const resampled = useMemo<SampledPoint[]>(() => {
    if (!data.length) return [];
    const now = Date.now();
    const cutoff30d = now - 30 * 24 * 3600 * 1000;

    const buckets = new Map<string, { values: number[]; isSale: boolean; isFreeWeekend: boolean; isRecent: boolean }>();

    for (const row of data) {
      const ts = new Date(row.timestamp).getTime();
      if (isNaN(ts)) continue;
      const isRecent = ts >= cutoff30d;
      const key = bucketKey(new Date(ts), isRecent);
      if (!buckets.has(key)) {
        buckets.set(key, { values: [], isSale: false, isFreeWeekend: false, isRecent });
      }
      const b = buckets.get(key)!;
      const v = Number(row.ccu_value);
      if (!isNaN(v)) b.values.push(v);
      if (row.is_sale_period === "TRUE" || row.is_sale_period === true) b.isSale = true;
      if (row.is_free_weekend === "TRUE" || row.is_free_weekend === true) b.isFreeWeekend = true;
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ts, b]) => ({
        ts,
        label: formatLabel(ts, b.isRecent),
        value: b.values.length ? Math.round(b.values.reduce((s, v) => s + v, 0) / b.values.length) : 0,
        isSale: b.isSale,
        isFreeWeekend: b.isFreeWeekend,
      }));
  }, [data]);

  // 최근 30일 인덱스 찾기 (스크롤 기준점)
  const recentStartIdx = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    return Math.max(0, resampled.findIndex(p => new Date(p.ts).getTime() >= cutoff));
  }, [resampled]);

  // 차트 총 너비 계산: 포인트당 픽셀
  const PX_PER_POINT = 10;
  const chartWidth = Math.max(containerW, resampled.length * PX_PER_POINT);

  // 마운트 시 최근 데이터로 스크롤
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setContainerW(el.clientWidth);
    // 최근 30일 시작 위치로 스크롤 (가장 최근이 오른쪽)
    el.scrollLeft = el.scrollWidth;
  }, [resampled]);

  // ReferenceArea 범위 계산 (label 키 기준)
  const saleRanges = useMemo(() => {
    const ranges: { start: string; end: string; type: "sale" | "freeweekend" }[] = [];
    let current: typeof ranges[0] | null = null;
    for (const d of resampled) {
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
  }, [resampled]);

  // XAxis tick 간격 — 최대 30개 표시
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
      {/* 범례 + 안내 */}
      <div className="flex items-center justify-between mb-3 text-xs flex-wrap gap-2">
        <div className="flex gap-4">
          <span className="flex items-center gap-1">
            <span className="w-3 h-1.5 bg-accent-orange/50 rounded inline-block" />할인 기간
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-1.5 bg-accent-green/50 rounded inline-block" />무료 주말
          </span>
        </div>
        <span className="text-text-muted">← 스크롤로 이전 데이터 확인 · 최근 30일 기준</span>
      </div>

      {/* 스크롤 가능한 차트 영역 */}
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
