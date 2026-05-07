"use client";
import { useMemo } from "react";
import type { TimelineRow } from "@/types";
import { useUiText } from "@/contexts/UiTextContext";

interface Props {
  timelineRows: TimelineRow[];
  shiftMonths?: Set<string>; // 급변 감지된 YYYY-MM
}

export default function KeywordTimeline({ timelineRows, shiftMonths = new Set() }: Props) {
  const { t } = useUiText();

  // monthly_summary, language_scope=all, 키워드 있는 것만 추출
  const monthlyRows = useMemo(() => {
    return timelineRows
      .filter(r =>
        (r.event_type === "monthly_summary" || r.event_type === "weekly_summary") &&
        r.language_scope === "all" &&
        r.top_keywords &&
        r.top_keywords !== "[]"
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [timelineRows]);

  const parsed = useMemo(() =>
    monthlyRows.map(r => {
      let keywords: string[] = [];
      try { keywords = JSON.parse(r.top_keywords || "[]"); } catch { /* empty */ }
      const rate = Number(r.sentiment_rate);
      return {
        ym:       r.date.slice(0, 7),
        label:    r.event_type === "weekly_summary" ? (r.title_kr || r.title) : r.date.slice(0, 7),
        keywords,
        rate:     isNaN(rate) ? null : rate,
        isShift:  shiftMonths.has(r.date.slice(0, 7)),
        isWeekly: r.event_type === "weekly_summary",
      };
    }),
  [monthlyRows, shiftMonths]);

  if (parsed.length === 0) return null;

  function rateColor(rate: number | null) {
    if (rate === null) return "text-text-muted";
    if (rate >= 80) return "text-accent-green";
    if (rate >= 60) return "text-accent-yellow";
    return "text-accent-red";
  }

  function kwColor(rate: number | null) {
    if (rate === null) return "bg-bg-secondary text-text-secondary border-border-default";
    if (rate >= 80) return "bg-accent-green/10 text-accent-green border-accent-green/20";
    if (rate >= 60) return "bg-accent-yellow/10 text-accent-yellow border-accent-yellow/20";
    return "bg-accent-red/10 text-accent-red border-accent-red/20";
  }

  return (
    <div className="mt-6">
      <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        {t("KEYWORD_TIMELINE_TITLE")}
      </h4>
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {parsed.map((row) => (
          <div
            key={row.ym + row.label}
            className={`flex items-start gap-3 py-2 px-3 rounded-lg transition-colors ${
              row.isShift
                ? "bg-accent-yellow/5 border border-accent-yellow/20"
                : "hover:bg-bg-secondary/40"
            }`}
          >
            {/* 날짜 + 긍정률 */}
            <div className="flex-shrink-0 w-24 text-right">
              <p className={`text-[10px] font-mono ${row.isWeekly ? "text-text-muted" : "text-text-secondary"}`}>
                {row.label}
              </p>
              {row.rate !== null && (
                <p className={`text-[11px] font-semibold tabular-nums ${rateColor(row.rate)}`}>
                  {row.rate.toFixed(0)}%
                </p>
              )}
            </div>

            {/* 급변 마커 */}
            <div className="flex-shrink-0 pt-1">
              {row.isShift ? (
                <span className="text-accent-yellow text-[10px]">⚡</span>
              ) : (
                <span className="w-1.5 h-1.5 mt-1 rounded-full inline-block bg-border-default opacity-60" />
              )}
            </div>

            {/* 키워드 칩들 */}
            <div className="flex flex-wrap gap-1 flex-1">
              {row.keywords.slice(0, 6).map((kw, i) => (
                <span
                  key={i}
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${kwColor(row.rate)}`}
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
