"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
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
  japanese: "일본어",
  russian: "러시아어",
};

export default function SentimentChart({ timelineRows, topLanguages }: SentimentChartProps) {
  const [langFilter, setLangFilter] = useState("all");

  const langOptions = ["all", "koreana", "english", ...topLanguages.filter(
    (l) => l !== "koreana" && l !== "english"
  )];

  const chartData = useMemo(() => {
    const rows = timelineRows.filter(
      (r) => r.language_scope === langFilter &&
             r.event_type !== "news" &&
             r.date &&
             r.sentiment_rate !== ""
    );
    return rows
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        date: r.date,
        rate: Number(r.sentiment_rate),
        title: r.title,
        isSale: r.is_sale_period === "TRUE" || r.is_sale_period === true,
        isFreeWeekend: r.is_free_weekend === "TRUE" || r.is_free_weekend === true,
      }));
  }, [timelineRows, langFilter]);

  // 평가 변동 원인 AI 코멘트 (all 스코프에서 가장 최신)
  const reactionComment = useMemo(() => {
    const allRows = timelineRows.filter(
      (r) => r.language_scope === "all" && r.ai_reaction_summary
    );
    allRows.sort((a, b) => b.date.localeCompare(a.date));
    return allRows[0]?.ai_reaction_summary ?? "";
  }, [timelineRows]);

  function getLineColor(rate: number) {
    if (rate >= 80) return "#5db865";
    if (rate >= 70) return "#d4b84a";
    if (rate >= 40) return "#e08c45";
    return "#e05c5c";
  }

  return (
    <div>
      {/* 언어 필터 */}
      <div className="flex gap-1 flex-wrap mb-4">
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

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-text-muted text-sm">
          이 언어의 분석 데이터가 없습니다.
        </div>
      ) : (
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
              formatter={(v: number) => [`${v}%`, "긍정률"]}
              labelFormatter={(label) => {
                const row = chartData.find((d) => d.date === label);
                return row ? `${label} - ${row.title}` : label;
              }}
            />
            <ReferenceLine y={80} stroke="#5db86540" strokeDasharray="4 4" label={{ value: "매우 긍정적", fill: "#5db865", fontSize: 10 }} />
            <ReferenceLine y={40} stroke="#e05c5c40" strokeDasharray="4 4" label={{ value: "복합적", fill: "#e05c5c", fontSize: 10 }} />

            <Line
              type="monotone"
              dataKey="rate"
              stroke="#4f87ff"
              strokeWidth={2.5}
              dot={(props) => {
                const { cx, cy, payload } = props;
                const color = getLineColor(payload.rate);
                return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={5} fill={color} stroke="#1e2130" strokeWidth={2} />;
              }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {reactionComment && (
        <div className="mt-4 bg-bg-card border border-accent-blue/20 rounded-lg px-4 py-3">
          <p className="text-xs text-accent-blue mb-1">AI 평가 변동 원인 진단</p>
          <p className="text-sm text-text-secondary leading-relaxed">{reactionComment}</p>
        </div>
      )}
    </div>
  );
}
