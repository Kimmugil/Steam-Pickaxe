"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, Legend,
} from "recharts";
import { useState, useMemo } from "react";
import type { CcuRow } from "@/types";

interface CcuChartProps {
  data: CcuRow[];
  topLanguages: string[];
  peaktimeComment?: string;
  compareGame?: { name: string; data: CcuRow[]; peakCcu: number };
  currentPeakCcu?: number;
}

const LANG_LABELS: Record<string, string> = {
  all: "전체",
  koreana: "한국어",
  english: "영어",
  schinese: "중국어(간체)",
  japanese: "일본어",
  russian: "러시아어",
};

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}시`;
  } catch {
    return ts;
  }
}

export default function CcuChart({
  data, topLanguages, peaktimeComment, compareGame, currentPeakCcu,
}: CcuChartProps) {
  const [langFilter, setLangFilter] = useState("all");
  const [useRatio, setUseRatio] = useState(false);

  const langOptions = ["all", "koreana", "english", ...topLanguages.filter(
    (l) => l !== "koreana" && l !== "english"
  )];

  const filtered = useMemo(() => {
    const src = langFilter === "all" ? data : data.filter((r) => !r.is_archived_gap);
    return src.map((row) => ({
      ts: row.timestamp,
      label: formatTimestamp(row.timestamp),
      value: useRatio && currentPeakCcu
        ? Math.round((Number(row.ccu_value) / currentPeakCcu) * 100 * 10) / 10
        : Number(row.ccu_value),
      isSale: row.is_sale_period === "TRUE" || row.is_sale_period === true,
      isFreeWeekend: row.is_free_weekend === "TRUE" || row.is_free_weekend === true,
      isGap: row.is_archived_gap === "TRUE" || row.is_archived_gap === true,
    }));
  }, [data, langFilter, useRatio, currentPeakCcu]);

  const compareFiltered = useMemo(() => {
    if (!compareGame) return [];
    return compareGame.data.map((row) => ({
      ts: row.timestamp,
      value: useRatio && compareGame.peakCcu
        ? Math.round((Number(row.ccu_value) / compareGame.peakCcu) * 100 * 10) / 10
        : Number(row.ccu_value),
    }));
  }, [compareGame, useRatio]);

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
      {/* 필터 & 토글 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-1 flex-wrap">
          {langOptions.map((lang) => (
            <button
              key={lang}
              onClick={() => setLangFilter(lang)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                langFilter === lang
                  ? "bg-accent-blue text-white"
                  : "bg-bg-card text-text-secondary hover:bg-bg-hover border border-border-default"
              }`}
            >
              {LANG_LABELS[lang] ?? lang}
            </button>
          ))}
        </div>
        {compareGame && (
          <button
            onClick={() => setUseRatio(!useRatio)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 border ${
              useRatio
                ? "bg-accent-purple/20 border-accent-purple/40 text-accent-purple"
                : "bg-bg-card border-border-default text-text-secondary hover:bg-bg-hover"
            }`}
          >
            {useRatio ? "비율(%) 보기" : "절대값 보기"}
            <span className="text-text-muted text-[10px] ml-0.5">(?)</span>
          </button>
        )}
      </div>

      {/* 범례 */}
      <div className="flex gap-4 mb-2 text-xs flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-1.5 bg-accent-orange/50 rounded inline-block" />할인 기간</span>
        <span className="flex items-center gap-1"><span className="w-3 h-1.5 bg-accent-green/50 rounded inline-block" />무료 주말</span>
        {compareGame && <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-accent-purple inline-block border-dashed border border-accent-purple" />{compareGame.name}</span>}
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
            tickFormatter={(v) => useRatio ? `${v}%` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ background: "#1e2130", border: "1px solid #2a2f45", borderRadius: 8, color: "#e8eaf0" }}
            formatter={(v: number) => [useRatio ? `${v}%` : `${v.toLocaleString()}명`, "CCU"]}
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

          {compareGame && compareFiltered.length > 0 && (
            <Line
              type="monotone"
              data={compareFiltered}
              dataKey="value"
              stroke="#8b6fe8"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              name={compareGame.name}
            />
          )}
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
