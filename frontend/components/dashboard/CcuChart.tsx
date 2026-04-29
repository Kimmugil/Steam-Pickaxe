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
type ViewMode = "line" | "heatmap";

// CCU 타임스탬프는 UTC로 저장됨 — 표시는 KST(UTC+9)로 변환
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 히트맵 display 순서: 월(1)~일(0)
const HEATMAP_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const HEATMAP_DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

/**
 * UTC 밀리초를 KST 시간 기준으로 버킷 키(숫자 문자열)로 변환합니다.
 * UTC 메서드로 KST 값을 읽을 수 있도록 KST_OFFSET_MS 만큼 이동한 뒤
 * getUTC*() 메서드를 사용합니다.
 */
function bucketKey(utcMs: number, isRecent: boolean): string {
  const kstMs = utcMs + KST_OFFSET_MS;
  const d = new Date(kstMs);
  if (isRecent) {
    const snappedH = Math.floor(d.getUTCHours() / 4) * 4;
    return String(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), snappedH, 0, 0));
  }
  return String(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * bucketKey가 반환한 숫자 문자열(KST 정렬 기준 ms)을 KST 레이블로 변환합니다.
 */
function formatLabel(tsKey: string, isRecent: boolean, hourSuffix = "시"): string {
  try {
    // tsKey 자체가 KST 기준으로 스냅된 UTC epoch ms이므로
    // getUTC*()를 호출하면 KST 시/일/월을 반환합니다.
    const d = new Date(Number(tsKey));
    const m   = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    if (!isRecent) return `${m}/${day}`;
    const h = d.getUTCHours();
    return h === 0 ? `${m}/${day}` : `${h}${hourSuffix}`;
  } catch {
    return tsKey;
  }
}

function resampleData(rows: CcuRow[], cutoffMs?: number, hourSuffix = "시"): SampledPoint[] {
  if (!rows.length) return [];
  const now = Date.now();
  const cutoff30d = now - 30 * 24 * 3600 * 1000;

  const filtered = cutoffMs ? rows.filter(r => new Date(r.timestamp).getTime() >= cutoffMs) : rows;

  const buckets = new Map<string, { values: number[]; isRecent: boolean }>();
  for (const row of filtered) {
    const utcMs = new Date(row.timestamp).getTime();
    if (isNaN(utcMs)) continue;
    const isRecent = utcMs >= cutoff30d;
    const key = bucketKey(utcMs, cutoffMs ? true : isRecent);
    if (!buckets.has(key)) buckets.set(key, { values: [], isRecent: cutoffMs ? true : isRecent });
    const b = buckets.get(key)!;
    const v = Number(row.ccu_value);
    if (!isNaN(v)) b.values.push(v);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => Number(a) - Number(b))   // 숫자 정렬 (UTC ms 기준)
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
  const [viewMode, setViewMode] = useState<ViewMode>("line");
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

  // 히트맵 집계: 요일(0=일~6=토) × 시간(0~23)
  const heatmapData = useMemo(() => {
    // grid[dayOfWeek][hour] = { sum, count }
    const grid: { sum: number; count: number }[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ sum: 0, count: 0 }))
    );

    for (const row of data) {
      const utcMs = new Date(row.timestamp).getTime();
      if (isNaN(utcMs)) continue;
      const v = Number(row.ccu_value);
      if (isNaN(v)) continue;

      // KST 기준 요일/시간 추출
      const kstMs = utcMs + KST_OFFSET_MS;
      const d = new Date(kstMs);
      const dayOfWeek = d.getUTCDay();   // 0=일~6=토 (KST 기준)
      const hour = d.getUTCHours();       // 0~23 (KST 기준)

      grid[dayOfWeek][hour].sum += v;
      grid[dayOfWeek][hour].count += 1;
    }

    // avg 계산
    return grid.map((dayRow) =>
      dayRow.map((cell) => ({
        avg: cell.count > 0 ? Math.round(cell.sum / cell.count) : 0,
        count: cell.count,
      }))
    );
  }, [data]);

  // 히트맵 전체 최대 avg
  const heatmapMax = useMemo(() => {
    let max = 0;
    for (const dayRow of heatmapData) {
      for (const cell of dayRow) {
        if (cell.count > 0 && cell.avg > max) max = cell.avg;
      }
    }
    return max;
  }, [heatmapData]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        {t("CCU_NO_DATA")}
      </div>
    );
  }

  return (
    <div>
      {/* 뷰 모드 토글 + 범위 선택 버튼 + KST 레이블 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {/* 꺾은선 / 히트맵 뷰 토글 */}
          {(["line", "heatmap"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                viewMode === mode
                  ? "bg-accent-blue/20 border border-accent-blue/40 text-accent-blue"
                  : "bg-bg-secondary border border-border-default text-text-muted hover:text-text-secondary"
              }`}
            >
              {mode === "line" ? "꺾은선" : "히트맵"}
            </button>
          ))}

          {/* 범위 버튼 — 꺾은선 모드일 때만 표시 */}
          {viewMode === "line" && (
            <>
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
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {viewMode === "line" && viewRange === "all" && (
            <span className="text-xs text-text-muted">{t("CCU_SCROLL_HINT")}</span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded border text-text-muted border-border-default bg-bg-secondary">
            KST
          </span>
        </div>
      </div>

      {/* 히트맵 뷰 */}
      {viewMode === "heatmap" ? (
        <div>
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-0.5 mx-auto">
              <thead>
                <tr>
                  {/* 빈 헤더 (요일 라벨 열) */}
                  <th className="w-6" />
                  {Array.from({ length: 24 }, (_, h) => (
                    <th key={h} className="text-[9px] text-text-muted font-normal text-center pb-1 w-7 sm:w-7 w-5">
                      {h}시
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HEATMAP_DAY_ORDER.map((dayOfWeek, idx) => {
                  const dayRow = heatmapData[dayOfWeek];
                  return (
                    <tr key={dayOfWeek}>
                      {/* 요일 라벨 */}
                      <td className="text-[10px] text-text-muted pr-1 text-right align-middle">
                        {HEATMAP_DAY_LABELS[idx]}
                      </td>
                      {dayRow.map((cell, hour) => {
                        const intensity = heatmapMax > 0 && cell.count > 0
                          ? cell.avg / heatmapMax
                          : 0;
                        const isMax = heatmapMax > 0 && cell.avg === heatmapMax && cell.count > 0;
                        const bg = cell.count === 0
                          ? undefined
                          : `rgba(79, 135, 255, ${intensity.toFixed(3)})`;
                        return (
                          <td key={hour}>
                            <div
                              className={`w-7 h-7 sm:w-7 sm:h-7 w-5 h-5 rounded-sm ${
                                cell.count === 0 ? "bg-bg-secondary" : ""
                              } ${isMax ? "border border-accent-blue/60" : ""}`}
                              style={bg ? { backgroundColor: bg } : undefined}
                              title={cell.count > 0 ? `평균 CCU: ${cell.avg.toLocaleString()}` : "데이터 없음"}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-text-muted text-center mt-3">
            전체 데이터 기반 · 시간대 KST 기준
          </p>
        </div>
      ) : (
        /* 꺾은선 뷰 */
        !resampled.length ? (
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
        )
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
