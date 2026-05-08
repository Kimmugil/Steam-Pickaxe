"use client";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { useState, useMemo, useRef } from "react";
import type { TimelineRow } from "@/types";
import { useChartTheme } from "@/lib/useChartTheme";
import LifecycleSummary from "@/components/dashboard/LifecycleSummary";

interface SentimentChartProps {
  timelineRows: TimelineRow[];
  topLanguages: string[];
  sentimentTrendComment?: string;
  shiftRows?: TimelineRow[];
  onShiftClick?: (ym: string) => void;
  onPointClick?: (ym: string) => void; // 차트 포인트·키워드 밴드 클릭 → 타임라인 이동
  lifecycleComment?: string;           // 게임 수명 주기 분석
}

/** "crashes (충돌)" → "충돌", "그래픽 (Graphics)" → "그래픽", "DLC" → "DLC" */
function extractKorean(raw: string): string {
  const match = raw.match(/^(.+?)\s*\((.+?)\)\s*$/);
  if (match) {
    const outside = match[1].trim();
    const inside  = match[2].trim();
    if (/[가-힣]/.test(inside))  return inside;
    if (/[가-힣]/.test(outside)) return outside;
    return outside; // 둘 다 영어면 바깥쪽 반환
  }
  return raw.trim();
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

interface ChartPoint {
  date: string;       // 정렬용 실제 날짜 "YYYY-MM-DD"
  label: string;      // X축 표시용
  type: "monthly" | "weekly";
  title: string;      // tooltip 헤더 ("2026년 03월" / "출시 1주차")
  review_count?: number | null;
  [key: string]: string | number | null | undefined; // lang → rate
}

export default function SentimentChart({
  timelineRows, topLanguages, sentimentTrendComment,
  shiftRows, onShiftClick, onPointClick, lifecycleComment,
}: SentimentChartProps) {
  const chart = useChartTheme();
  const bandScrollRef = useRef<HTMLDivElement>(null);
  const langOptions = ["all", ...topLanguages.filter((l) => l !== "all")];

  // 다중 선택 — 초기값: "all"만 활성화
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set(["all"]));

  // 볼륨 표시 토글
  const [showVolume, setShowVolume] = useState(true);

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

  // 통합 데이터 포인트 수집 (monthly + weekly)
  // dateKey → { date, label, type, title }
  const pointMeta = useMemo(() => {
    const meta: Map<string, { date: string; label: string; type: "monthly" | "weekly"; title: string }> = new Map();

    for (const r of timelineRows) {
      if (!r.date) continue;
      if (r.sentiment_rate === "" || String(r.sentiment_rate) === "sparse") continue;

      if (r.event_type === "monthly_summary") {
        const ym = r.date.slice(0, 7);
        const dateKey = `${ym}-01`;
        if (!meta.has(dateKey)) {
          const [y, mo] = ym.split("-");
          meta.set(dateKey, {
            date: dateKey,
            label: ym,
            type: "monthly",
            title: `${y}년 ${mo}월`,
          });
        }
      } else if (r.event_type === "weekly_summary") {
        const dateKey = r.date; // "YYYY-MM-DD"
        if (!meta.has(dateKey)) {
          const [, mo, d] = r.date.split("-");
          meta.set(dateKey, {
            date: dateKey,
            label: `${parseInt(mo)}/${parseInt(d)}`,
            type: "weekly",
            title: r.title || r.date,  // "출시 N주차"
          });
        }
      }
    }

    return meta;
  }, [timelineRows]);

  // 정렬된 포인트 목록
  const allPoints = useMemo(() =>
    Array.from(pointMeta.values()).sort((a, b) => a.date.localeCompare(b.date)),
    [pointMeta]
  );

  // 주간 데이터가 존재하는지 여부
  const hasWeeklyData = useMemo(() =>
    Array.from(pointMeta.values()).some(p => p.type === "weekly"),
    [pointMeta]
  );

  // dateKey → 언어 → 긍정률 맵
  const rateMap = useMemo(() => {
    const map: Record<string, Record<string, number | null>> = {};

    for (const r of timelineRows) {
      if (!r.date) continue;
      if (r.sentiment_rate === "" || String(r.sentiment_rate) === "sparse") continue;
      const rate = Number(r.sentiment_rate);
      if (isNaN(rate)) continue;

      let dateKey: string | null = null;
      if (r.event_type === "monthly_summary") {
        dateKey = `${r.date.slice(0, 7)}-01`;
      } else if (r.event_type === "weekly_summary") {
        dateKey = r.date;
      }
      if (!dateKey) continue;

      if (!map[dateKey]) map[dateKey] = {};
      map[dateKey][r.language_scope] = rate;
    }

    return map;
  }, [timelineRows]);

  // dateKey → review_count 맵 (language_scope === "all", monthly/weekly_summary)
  // 월간 summary에 review_count가 없으면 해당 월의 주간 합계로 대체
  const volumeMap = useMemo(() => {
    const monthlyMap: Record<string, number> = {};   // "YYYY-MM-01" → count
    const weeklyByMonth: Record<string, number> = {}; // "YYYY-MM" → sum of weekly counts

    for (const r of timelineRows) {
      if (!r.date) continue;
      if (r.language_scope !== "all") continue;
      const count = Number(r.review_count);

      if (r.event_type === "monthly_summary" && !isNaN(count) && count > 0) {
        monthlyMap[`${r.date.slice(0, 7)}-01`] = count;
      } else if (r.event_type === "weekly_summary" && !isNaN(count) && count > 0) {
        const ym = r.date.slice(0, 7);
        weeklyByMonth[ym] = (weeklyByMonth[ym] ?? 0) + count;
      }
    }

    // 주간 포인트 자체의 볼륨도 포함
    const weeklyPointMap: Record<string, number> = {};
    for (const r of timelineRows) {
      if (!r.date) continue;
      if (r.language_scope !== "all") continue;
      if (r.event_type !== "weekly_summary") continue;
      const count = Number(r.review_count);
      if (!isNaN(count) && count > 0) weeklyPointMap[r.date] = count;
    }

    // 월간 포인트: 자체 count가 없으면 주간 합계로 대체
    const map: Record<string, number> = { ...weeklyPointMap };
    for (const r of timelineRows) {
      if (!r.date) continue;
      if (r.language_scope !== "all") continue;
      if (r.event_type !== "monthly_summary") continue;
      const dateKey = `${r.date.slice(0, 7)}-01`;
      const ym = r.date.slice(0, 7);
      const count = monthlyMap[dateKey] ?? weeklyByMonth[ym] ?? 0;
      if (count > 0) map[dateKey] = count;
    }

    return map;
  }, [timelineRows]);

  // 차트 데이터: 정렬된 포인트별 언어 긍정률 + 볼륨 포함
  const chartData = useMemo((): ChartPoint[] => {
    return allPoints.map((pt) => {
      const entry: ChartPoint = {
        date: pt.date,
        label: pt.label,
        type: pt.type,
        title: pt.title,
        review_count: volumeMap[pt.date] ?? null,
      };
      for (const lang of langOptions) {
        entry[lang] = rateMap[pt.date]?.[lang] ?? null;
      }
      return entry;
    });
  }, [allPoints, rateMap, langOptions, volumeMap]);

  // 급변 감지가 있는 YYYY-MM 집합 (마커 렌더링에 사용)
  const shiftMonths = useMemo(() => {
    const set = new Set<string>();
    for (const r of shiftRows ?? []) {
      const ym = r.date?.slice(0, 7);
      if (ym) set.add(ym);
      if (r.date_end) {
        const ym2 = r.date_end.slice(0, 7);
        if (ym2) set.add(ym2);
      }
    }
    return set;
  }, [shiftRows]);

  // 날짜키 → 원본 키워드 목록 (툴팁용)
  const keywordsByDateKey = useMemo<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    for (const r of timelineRows) {
      if (!r.date) continue;
      if (r.language_scope !== "all") continue;
      if (!r.top_keywords || r.top_keywords === "[]") continue;
      if (r.event_type !== "monthly_summary" && r.event_type !== "weekly_summary") continue;
      let kws: string[] = [];
      try { kws = JSON.parse(r.top_keywords); } catch { continue; }
      const dateKey = r.event_type === "monthly_summary"
        ? `${r.date.slice(0, 7)}-01`
        : r.date;
      if (!map[dateKey]) map[dateKey] = kws;
    }
    return map;
  }, [timelineRows]);

  // 하단 코멘트: sentiment_trend_comment 우선, 없으면 최신 monthly_summary의 ai_reaction_summary 폴백
  const trendComment = useMemo(() => {
    if (sentimentTrendComment) return sentimentTrendComment;
    const summaryRows = timelineRows.filter(
      (r) => r.event_type === "monthly_summary" && r.language_scope === "all" && r.ai_reaction_summary
    );
    summaryRows.sort((a, b) => b.date.localeCompare(a.date));
    return summaryRows[0]?.ai_reaction_summary ?? "";
  }, [sentimentTrendComment, timelineRows]);

  // 키워드 밴드 데이터 (language_scope=all, 키워드 있는 것만)
  const keywordBandData = useMemo(() => {
    return timelineRows
      .filter(r =>
        (r.event_type === "monthly_summary" || r.event_type === "weekly_summary") &&
        r.language_scope === "all" &&
        r.top_keywords && r.top_keywords !== "[]"
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => {
        let keywords: string[] = [];
        try { keywords = JSON.parse(r.top_keywords || "[]"); } catch { /* empty */ }
        const rate = Number(r.sentiment_rate);
        const ym = r.date.slice(0, 7);
        return {
          ym,
          label: r.event_type === "weekly_summary" ? (r.title_kr || r.title || ym) : ym,
          keywords: keywords.slice(0, 4).map(extractKorean),
          rate: isNaN(rate) ? null : rate,
          isShift: shiftMonths.has(ym),
          isWeekly: r.event_type === "weekly_summary",
        };
      });
  }, [timelineRows, shiftMonths]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        {"데이터 없음"}
      </div>
    );
  }

  return (
    <div>
      {/* 언어 토글 버튼 + 볼륨 토글 + 마커 범례 */}
      <div className="flex gap-1 flex-wrap mb-4 items-center">
        <span className="text-xs text-text-muted mr-1">{"언어 필터"}</span>
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

        {/* 볼륨 토글 버튼 */}
        <button
          onClick={() => setShowVolume((v) => !v)}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            showVolume
              ? "bg-accent-blue/10 border border-accent-blue/30 text-accent-blue"
              : "bg-bg-secondary border border-border-default text-text-muted"
          }`}
        >
          볼륨
        </button>

        {/* 주간 데이터 범례 */}
        {hasWeeklyData && (
          <span className="flex items-center gap-1.5 text-xs text-text-muted shrink-0 ml-1">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="5" fill={chart.dotBgFill} stroke="#4f87ff" strokeWidth="2" />
              <circle cx="8" cy="8" r="2" fill="#4f87ff" />
            </svg>
            주간
          </span>
        )}

        {/* 급변 마커 범례 — shift 데이터가 있을 때만 표시 */}
        {shiftMonths.size > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-text-muted shrink-0 ml-1">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="6" fill="none" stroke="#f5c842" strokeWidth="2" opacity="0.8" />
              <circle cx="8" cy="8" r="3" fill="#4f87ff" />
            </svg>
            {"급변 감지"}
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={chartData}
          margin={{ top: 5, right: showVolume ? 45 : 20, left: 0, bottom: 5 }}
          style={{ cursor: onPointClick ? "pointer" : undefined }}
          onClick={(data: { activePayload?: Array<{ payload: ChartPoint }> }) => {
            const pt = data?.activePayload?.[0]?.payload;
            if (pt && onPointClick) onPointClick(pt.date.slice(0, 7));
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={chart.gridStroke} />
          <XAxis
            dataKey="label"
            tick={{ fill: chart.axisTextFill, fontSize: 11 }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="left"
            domain={[0, 100]}
            tick={{ fill: chart.axisTextFill, fontSize: 11 }}
            tickFormatter={(v) => `${v}%`}
            tickLine={false}
            axisLine={false}
          />
          {showVolume && (
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, "auto"]}
              tick={{ fill: chart.axisTextFill, fontSize: 10 }}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
              tickLine={false}
              axisLine={false}
              width={35}
            />
          )}
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const pt = payload[0]?.payload as ChartPoint;
              if (!pt) return null;
              const kws = (keywordsByDateKey[pt.date] ?? [])
                .map(extractKorean).slice(0, 5);
              const header = pt.type === "weekly"
                ? `📅 ${pt.title}  (${pt.date})`
                : pt.title;
              return (
                <div style={{
                  background: "rgb(var(--bg-card-rgb))",
                  border: "1px solid rgb(var(--border-default-rgb))",
                  borderRadius: 8,
                  color: "rgb(var(--text-primary-rgb))",
                  fontSize: 12,
                  minWidth: 140, maxWidth: 220, overflow: "hidden",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                }}>
                  <div style={{ padding: "6px 12px 5px", borderBottom: "1px solid rgb(var(--border-default-rgb))" }}>
                    <p style={{ color: "rgb(var(--text-secondary-rgb))", fontSize: 11, margin: 0 }}>{header}</p>
                  </div>
                  <div style={{ padding: "6px 12px 4px" }}>
                    {payload.map((entry) => {
                      if (entry.value === null || entry.value === undefined) return null;
                      if (entry.dataKey === "review_count") return (
                        <p key="vol" style={{ margin: "2px 0", color: "rgb(var(--accent-blue-rgb))", opacity: 0.85 }}>
                          리뷰 볼륨: {Number(entry.value).toLocaleString()}건
                        </p>
                      );
                      const label = LANG_LABELS[entry.dataKey as string] ?? String(entry.dataKey);
                      return (
                        <p key={String(entry.dataKey)} style={{ margin: "2px 0", color: entry.color as string }}>
                          {label}: {entry.value}%
                        </p>
                      );
                    })}
                  </div>
                  {kws.length > 0 && (
                    <div style={{ padding: "4px 12px 8px", borderTop: "1px solid rgb(var(--border-default-rgb))" }}>
                      <p style={{ color: "rgb(var(--text-secondary-rgb))", fontSize: 10, margin: "0 0 4px" }}>주요 키워드</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {kws.map((kw, i) => (
                          <span key={i} style={{
                            fontSize: 10, padding: "1px 6px", borderRadius: 4,
                            background: "rgb(var(--border-default-rgb))",
                            color: "rgb(var(--text-secondary-rgb))",
                            border: "1px solid rgb(var(--border-hover-rgb))",
                          }}>{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }}
          />
          {selectedLangs.size > 1 && (
            <Legend
              formatter={(value) => LANG_LABELS[value] ?? value}
              wrapperStyle={{ fontSize: 11, color: "rgb(var(--text-secondary-rgb))" }}
            />
          )}
          <ReferenceLine yAxisId="left" y={80} stroke="#5db86540" strokeDasharray="4 4" label={{ value: "매우 긍정", fill: "#5db865", fontSize: 10 }} />
          <ReferenceLine yAxisId="left" y={40} stroke="#e05c5c40" strokeDasharray="4 4" label={{ value: "복합 평가", fill: "#e05c5c", fontSize: 10 }} />

          {showVolume && (
            <Bar
              yAxisId="right"
              dataKey="review_count"
              fill="#4f87ff"
              opacity={0.15}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
          )}

          {langOptions.map((lang) => {
            if (!selectedLangs.has(lang)) return null;
            const color = LANG_COLORS[lang] ?? "#8b91a8";
            return (
              <Line
                key={lang}
                yAxisId="left"
                type="monotone"
                dataKey={lang}
                stroke={color}
                strokeWidth={lang === "all" ? 2.5 : 1.8}
                strokeDasharray={lang === "all" ? undefined : "5 3"}
                dot={(props) => {
                  const { cx, cy, payload } = props as {
                    cx: number; cy: number;
                    payload: ChartPoint;
                  };
                  const val = payload[lang];
                  if (val === null || val === undefined) return <g key={`dot-${cx}-${cy}-${lang}`} />;
                  const isWeekly = payload.type === "weekly";
                  const hasShift = shiftMonths.has(payload.date.slice(0, 7));
                  const isShiftDot = hasShift && lang === "all";
                  return (
                    <g
                      key={`dot-${cx}-${cy}-${lang}`}
                      onClick={isShiftDot ? () => onShiftClick?.(payload.date.slice(0, 7)) : undefined}
                      style={isShiftDot ? { cursor: "pointer" } : undefined}
                    >
                      {isShiftDot && (
                        <>
                          {/* 클릭 히트 영역 확장 */}
                          <circle cx={cx} cy={cy} r={14} fill="transparent" />
                          <circle cx={cx} cy={cy} r={8} fill="none" stroke="#f5c842" strokeWidth={2} opacity={0.8} />
                        </>
                      )}
                      {isWeekly ? (
                        // 주간: hollow(속이 빈) 도트
                        <>
                          <circle cx={cx} cy={cy} r={5} fill={chart.dotBgFill} stroke={color} strokeWidth={2} />
                          <circle cx={cx} cy={cy} r={2} fill={color} />
                        </>
                      ) : (
                        // 월간: solid 도트
                        <circle cx={cx} cy={cy} r={4} fill={color} stroke={chart.dotBgFill} strokeWidth={2} />
                      )}
                    </g>
                  );
                }}
                activeDot={{ r: 5 }}
                connectNulls={true}
                name={lang}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>

      {trendComment && (
        <div className="mt-4 bg-bg-card border border-accent-blue/20 rounded-lg px-4 py-3">
          <p className="text-xs text-accent-blue mb-1">
            {sentimentTrendComment ? "AI 평가 추이 종합 진단" : "AI 평가 변동 원인 진단 (최근 이벤트 기준)"}
          </p>
          <p className="text-sm text-text-secondary leading-relaxed">{trendComment}</p>
        </div>
      )}

      {/* ── 게임 수명 주기 분석 ──────────────────────────────────────────── */}
      {lifecycleComment && (
        <div className="mt-4">
          <LifecycleSummary lifecycleComment={lifecycleComment} />
        </div>
      )}

      {/* ── 키워드 밴드 ─────────────────────────────────────────────────── */}
      {keywordBandData.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              {"키워드 타임라인"}
            </p>
            {keywordBandData.length > 8 && (
              <span className="text-[10px] text-text-muted">← 스크롤</span>
            )}
          </div>
          <div ref={bandScrollRef} className="overflow-x-auto pb-1 -mx-1 px-1">
            <div
              className="flex gap-1.5"
              style={{ minWidth: `${keywordBandData.length * 90}px` }}
            >
              {keywordBandData.map((row) => {
                const rateColor =
                  row.rate === null ? "text-text-muted"
                  : row.rate >= 80 ? "text-accent-green"
                  : row.rate >= 60 ? "text-accent-yellow"
                  : "text-accent-red";

                const kwStyle =
                  row.rate === null
                    ? "bg-bg-secondary/60 text-text-muted border-border-default"
                    : row.rate >= 80
                    ? "bg-accent-green/10 text-accent-green border-accent-green/20"
                    : row.rate >= 60
                    ? "bg-accent-yellow/10 text-accent-yellow border-accent-yellow/20"
                    : "bg-accent-red/10 text-accent-red border-accent-red/20";

                const barColor =
                  row.rate === null ? 0
                  : row.rate >= 80 ? 1   // green
                  : row.rate >= 60 ? 2   // yellow
                  : 3;                   // red

                const barClass = ["bg-border-default", "bg-accent-green", "bg-accent-yellow", "bg-accent-red"][barColor];

                return (
                  <div
                    key={row.ym + row.label}
                    onClick={() => onPointClick?.(row.ym)}
                    className={`flex-shrink-0 w-[84px] rounded-lg px-2 pt-2 pb-2 flex flex-col gap-1 transition-colors ${
                      onPointClick ? "cursor-pointer hover:brightness-125" : ""
                    } ${
                      row.isShift
                        ? "bg-accent-yellow/5 border border-accent-yellow/25"
                        : "bg-bg-secondary/30 border border-transparent hover:border-border-default"
                    }`}
                  >
                    {/* 상단: 날짜 + 급변 아이콘 */}
                    <div className="flex items-center gap-0.5">
                      {row.isShift && (
                        <span className="text-accent-yellow text-[9px] flex-shrink-0">⚡</span>
                      )}
                      <span
                        className={`text-[9px] font-mono leading-tight truncate ${
                          row.isWeekly ? "text-text-muted" : "text-text-secondary"
                        }`}
                        title={row.label}
                      >
                        {row.label}
                      </span>
                    </div>

                    {/* 긍정률 + 게이지 바 */}
                    {row.rate !== null && (
                      <div>
                        <span className={`text-[12px] font-bold tabular-nums leading-none ${rateColor}`}>
                          {row.rate.toFixed(0)}%
                        </span>
                        <div className="mt-0.5 h-0.5 rounded-full bg-bg-secondary overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barClass}`}
                            style={{ width: `${row.rate}%`, opacity: 0.6 }}
                          />
                        </div>
                      </div>
                    )}

                    {/* 키워드 칩 */}
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {row.keywords.map((kw, i) => (
                        <span
                          key={i}
                          className={`text-[9px] px-1 py-0.5 rounded border leading-tight truncate ${kwStyle}`}
                          title={kw}
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
