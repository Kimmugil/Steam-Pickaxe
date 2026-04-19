"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { useState, useMemo } from "react";
import type { TimelineRow } from "@/types";

interface SentimentChartProps {
  timelineRows: TimelineRow[];
  topLanguages: string[];
}

const LANG_LABELS: Record<string, string> = {
  all: "전체",
  koreana: "한국어",
  english: "영어",
  schinese: "중국어(간체)",
  tchinese: "중국어(번체)",
  japanese: "일본어",
  russian: "러시아어",
  french: "프랑스어",
  german: "독일어",
  spanish: "스페인어",
  brazilian: "포르투갈어",
  thai: "태국어",
};

// 언어별 고정 색상
const LANG_COLORS: Record<string, string> = {
  all:      "#4f87ff",
  koreana:  "#5db865",
  english:  "#e08c45",
  schinese: "#8b6fe8",
  tchinese: "#e05c5c",
  japanese: "#d4b84a",
  russian:  "#64b5f6",
  french:   "#f06292",
  german:   "#4db6ac",
  spanish:  "#ff8a65",
  brazilian:"#a1887f",
  thai:     "#ce93d8",
};

export default function SentimentChart({ timelineRows, topLanguages }: SentimentChartProps) {
  const langOptions = ["all", ...topLanguages.filter((l) => l !== "all")];

  // 다중 선택 — 초기값: "all"만 활성화
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set(["all"]));

  function toggleLang(lang: string) {
    setSelectedLangs((prev) => {
      const next = new Set(prev);
      if (next.has(lang)) {
        // 마지막 하나는 해제 불가
        if (next.size > 1) next.delete(lang);
      } else {
        next.add(lang);
      }
      return next;
    });
  }

  // 날짜 목록 (전체 스코프에서 추출, 정렬)
  const allDates = useMemo(() => {
    const dates = new Set<string>();
    for (const r of timelineRows) {
      if (r.date && r.event_type !== "news" && r.sentiment_rate !== "" && String(r.sentiment_rate) !== "sparse") {
        dates.add(r.date);
      }
    }
    return [...dates].sort();
  }, [timelineRows]);

  // 날짜 × 언어 → 긍정률 맵
  const rateMap = useMemo(() => {
    const map: Record<string, Record<string, number | null>> = {};
    for (const r of timelineRows) {
      if (!r.date || r.event_type === "news" || r.sentiment_rate === "" || String(r.sentiment_rate) === "sparse") continue;
      const scope = r.language_scope;
      const rate = Number(r.sentiment_rate);
      if (isNaN(rate)) continue;
      if (!map[r.date]) map[r.date] = {};
      map[r.date][scope] = rate;
    }
    return map;
  }, [timelineRows]);

  // title 맵 (날짜 → title, all 스코프 기준)
  const titleMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of timelineRows) {
      if (r.language_scope === "all" && r.date && r.title) {
        m[r.date] = r.title;
      }
    }
    return m;
  }, [timelineRows]);

  // 차트 데이터: 날짜별로 선택된 언어들의 값
  const chartData = useMemo(() => {
    return allDates.map((date) => {
      const entry: Record<string, string | number | null> = { date };
      for (const lang of langOptions) {
        entry[lang] = rateMap[date]?.[lang] ?? null;
      }
      return entry;
    });
  }, [allDates, rateMap, langOptions]);

  // 가장 최신 all 스코프 ai_reaction_summary
  const reactionComment = useMemo(() => {
    const allRows = timelineRows.filter((r) => r.language_scope === "all" && r.ai_reaction_summary);
    allRows.sort((a, b) => b.date.localeCompare(a.date));
    return allRows[0]?.ai_reaction_summary ?? "";
  }, [timelineRows]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        분석 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div>
      {/* 언어 토글 버튼 — 다중 선택 가능 */}
      <div className="flex gap-1 flex-wrap mb-4 items-center">
        <span className="text-xs text-text-muted mr-1">언어 선택:</span>
        {langOptions.map((lang) => {
          const active = selectedLangs.has(lang);
          const color = LANG_COLORS[lang] ?? "#8b91a8";
          return (
            <button
              key={lang}
              onClick={() => toggleLang(lang)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${
                active
                  ? "text-white border-transparent"
                  : "bg-bg-card text-text-secondary hover:bg-bg-hover border-border-default"
              }`}
              style={active ? { backgroundColor: color, borderColor: color } : {}}
            >
              {LANG_LABELS[lang] ?? lang}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
          <XAxis dataKey="date" tick={{ fill: "#8b91a8", fontSize: 11 }} tickLine={false} />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#8b91a8", fontSize: 11 }}
            tickFormatter={(v) => `${v}%`}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ background: "#1e2130", border: "1px solid #2a2f45", borderRadius: 8, color: "#e8eaf0" }}
            formatter={(v: number, name: string) => [`${v}%`, LANG_LABELS[name] ?? name]}
            labelFormatter={(label) => {
              const title = titleMap[label as string];
              return title ? `${label} — ${title}` : String(label);
            }}
          />
          {selectedLangs.size > 1 && (
            <Legend
              formatter={(value) => LANG_LABELS[value] ?? value}
              wrapperStyle={{ fontSize: 11, color: "#8b91a8" }}
            />
          )}
          <ReferenceLine y={80} stroke="#5db86540" strokeDasharray="4 4" label={{ value: "매우 긍정적", fill: "#5db865", fontSize: 10 }} />
          <ReferenceLine y={40} stroke="#e05c5c40" strokeDasharray="4 4" label={{ value: "복합적", fill: "#e05c5c", fontSize: 10 }} />

          {langOptions.map((lang) => {
            if (!selectedLangs.has(lang)) return null;
            const color = LANG_COLORS[lang] ?? "#8b91a8";
            return (
              <Line
                key={lang}
                type="monotone"
                dataKey={lang}
                stroke={color}
                strokeWidth={lang === "all" ? 2.5 : 1.8}
                strokeDasharray={lang === "all" ? undefined : "5 3"}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  const val = payload[lang];
                  if (val === null || val === undefined) return <g key={`dot-${cx}-${cy}`} />;
                  return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={color} stroke="#1e2130" strokeWidth={2} />;
                }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                name={lang}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>

      {reactionComment && (
        <div className="mt-4 bg-bg-card border border-accent-blue/20 rounded-lg px-4 py-3">
          <p className="text-xs text-accent-blue mb-1">AI 평가 변동 원인 진단</p>
          <p className="text-sm text-text-secondary leading-relaxed">{reactionComment}</p>
        </div>
      )}
    </div>
  );
}
