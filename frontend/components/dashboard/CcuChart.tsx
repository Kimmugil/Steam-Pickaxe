"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useMemo, useRef, useEffect, useState } from "react";
import type { CcuRow } from "@/types";
import { useUiText } from "@/contexts/UiTextContext";

interface CcuChartProps {
  data: CcuRow[];
  peaktimeComment?: string;
}

interface SampledPoint {
  ts: string;
  label: string;
  value: number;
}

type ViewRange = "all" | "90d" | "30d";

function bucketKey(date: Date, isRecent: boolean): string {
  const d = new Date(date);
  if (isRecent) {
    d.setHours(Math.floor(d.getHours() / 4) * 4, 0, 0, 0);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d.toISOString();
}

function formatLabel(iso: string, isRecent: boolean, hourSuffix = "시"): string {
  try {
    const d = new Date(iso);
    const m = d.getMonth() + 1;
    const day = d.getDate();
    if (!isRecent) return `${m}/${day}`;
    const h = d.getHours();
    return h === 0 ? `${m}/${day}` : `${h}${hourSuffix}`;
  } catch {
    return iso;
  }
}

function resampleData(rows: CcuRow[], cutoffMs?: number, hourSuffix = "시"): SampledPoint[] {
  if (!rows.length) return [];
  const now = Date.now();
  const cutoff30d = now - 30 * 24 * 3600 * 1000;

  const filtered = cutoffMs ? rows.filter(r => new Date(r.timestamp).getTime() >= cutoffMs) : rows;

  const buckets = new Map<string, { values: number[]; isRecent: boolean }>();
  for (const row of filtered) {
    const ts = new Date(row.timestamp).getTime();
    if (isNaN(ts)) continue;
    const isRecent = ts >= cutoff30d;
    const key = bucketKey(new Date(ts), cutoffMs ? true : isRecent);
    if (!buckets.has(key)) buckets.set(key, { values: [], isRecent: cutoffMs ? true : isRecent });
    const b = buckets.get(key)!;
    const v = Number(row.ccu_value);
    if (!isNaN(v)) b.values.push(v);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ts, b]) => ({
      ts,
      label: formatLabel(ts, b.isRecent, hourSuffix),
      value: b.values.length ? Math.round(b.values.reduce((s, v) => s + v, 0) / b.values.length) : 0,
    }));
}

export default function CcuChart({ data, peaktimeComment }: CcuChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(800);
  const [viewRange, setViewRange] = useState<ViewRange>("30d");
  const { t } = useUiText();
  const VIEW_LABELS: Record<ViewRange, string> = {
    all: t("CCU_VIEW_ALL"),
    "90d": t("CCU_VIEW_90D"),
    "30d": t("CCU_VIEW_30D"),
  };
  const hourSuffix = t("CCU_HOUR_SUFFIX");

  const cutoffMs = useMemo(() => {
    const now = Date.now();
    if (viewRange === "30d") return now - 30 * 24 * 3600 * 1000;
    if (viewRange === "90d") return now - 90 * 24 * 3600 * 1000;
    return undefined;
  }, [viewRange]);

  const resampled = useMemo<SampledPoint[]>(() => resampleData(data, cutoffMs, hourSuffix), [data, cutoffMs, hourSuffix]);

  const yDomain = useMemo(() => {
    if (!resampled.length) return [0, "auto"] as [number, string];
    const max = Math.max(...resampled.map(p => p.value));
    return [0, Math.ceil(max * 1.1)] as [number, number];
  }, [resampled]);

  const PX_PER_POINT = 10;
  const chartWidth = viewRange === "all"
    ? Math.max(containerW, resampled.length * PX_PER_POINT)
    : containerW;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setContainerW(el.clientWidth);
    if (viewRange === "all") el.scrollLeft = el.scrollWidth;
  }, [resampled, viewRange]);

  // 컨테이너 크기 변경 감지
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setContainerW(el.clientWidth));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const tickInterval = Math.max(1, Math.floor(resampled.length / 30));

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        {t("CCU_NO_DATA")}
      </div>
    );
  }

  return (
    <div>
      {/* 범위 선택 버튼 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {(["30d", "90d", "all"] as ViewRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setViewRange(r)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                viewRange === r
                  ? "bg-accent-blue/20 border border-accent-blue/40 text-accent-blue"
                  : "bg-bg-secondary border border-border-default text-text-muted hover:text-text-secondary"
              }`}
            >
              {VIEW_LABELS[r]}
            </button>
          ))}
        </div>
        {viewRange === "all" && (
          <span className="text-xs text-text-muted">{t("CCU_SCROLL_HINT")}</span>
        )}
      </div>

      {!resampled.length ? (
        <div className="flex items-center justify-center h-64 text-text-muted text-sm">
          {t("CCU_NO_DATA_PERIOD")}
        </div>
      ) : (
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
                  domain={yDomain}
                  tick={{ fill: "#8b91a8", fontSize: 11 }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{ background: "#1e2130", border: "1px solid #2a2f45", borderRadius: 8, color: "#e8eaf0" }}
                  formatter={(v: number) => [`${v.toLocaleString()}${t("CCU_TOOLTIP_UNIT")}`, "CCU"]}
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
      )}

      {peaktimeComment && (
        <div className="mt-4 bg-bg-card border border-accent-blue/20 rounded-lg px-4 py-3">
          <p className="text-xs text-accent-blue mb-1">{t("CCU_PEAKTIME_LABEL")}</p>
          <p className="text-sm text-text-secondary leading-relaxed">{peaktimeComment}</p>
        </div>
      )}
    </div>
  );
}
