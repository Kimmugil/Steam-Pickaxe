"use client";
import { useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import Badge from "@/components/shared/Badge";
import type { TimelineRow } from "@/types";

interface LanguageTabProps {
  timelineRows: TimelineRow[];
  crossAnalysisComment?: string;
  /** RAW 리뷰 전체 기반 언어 분포 { language: reviewCount } — 파이 차트용 */
  languageDistribution?: Record<string, number>;
}

const LANG_NAMES: Record<string, string> = {
  english:   "영어",
  koreana:   "한국어",
  schinese:  "중국어(간체)",
  tchinese:  "중국어(번체)",
  japanese:  "일본어",
  russian:   "러시아어",
  french:    "프랑스어",
  german:    "독일어",
  spanish:   "스페인어",
  brazilian: "포르투갈어",
  thai:      "태국어",
  italian:   "이탈리아어",
  turkish:   "터키어",
  polish:    "폴란드어",
};

const PIE_COLORS = ["#4f87ff", "#5db865", "#8b6fe8", "#e08c45", "#e05c5c", "#888fa8"];
const PIE_TOP_N = 5; // 개별 표시할 최대 언어 수 (나머지 → 기타)

export default function LanguageTab({ timelineRows, crossAnalysisComment, languageDistribution }: LanguageTabProps) {
  // ── 1. 리스트 스탯 (전체 언어) ────────────────────────────────────
  const stats = useMemo(() => {
    const allScopeRows = timelineRows.filter(
      (r) => r.language_scope !== "all" && r.language_scope && r.event_type !== "news"
    );

    const sentimentMap: Record<string, { sentimentSum: number; count: number; keywords: string[] }> = {};
    for (const r of allScopeRows) {
      const lang = r.language_scope;
      if (!sentimentMap[lang]) sentimentMap[lang] = { sentimentSum: 0, count: 0, keywords: [] };
      if (r.sentiment_rate !== "" && String(r.sentiment_rate) !== "sparse") {
        sentimentMap[lang].sentimentSum += Number(r.sentiment_rate);
        sentimentMap[lang].count += 1;
      }
      if (r.top_keywords) {
        try {
          const kws: string[] = JSON.parse(r.top_keywords);
          sentimentMap[lang].keywords = [...new Set([...sentimentMap[lang].keywords, ...kws])].slice(0, 5);
        } catch { /* ignore */ }
      }
    }

    // 언어 목록 결정: languageDistribution 우선, 없으면 타임라인 폴백
    const hasDist = languageDistribution && Object.keys(languageDistribution).length > 0;
    let langEntries: [string, number][];
    if (hasDist) {
      langEntries = Object.entries(languageDistribution).sort((a, b) => b[1] - a[1]);
    } else {
      const reviewMap: Record<string, number> = {};
      for (const r of allScopeRows) {
        const lang = r.language_scope;
        reviewMap[lang] = (reviewMap[lang] ?? 0) + Number(r.review_count || 0);
      }
      langEntries = Object.entries(reviewMap).sort((a, b) => b[1] - a[1]);
    }

    const total = langEntries.reduce((s, [, c]) => s + c, 0);
    return langEntries.map(([lang, reviews]) => {
      const s = sentimentMap[lang] ?? { sentimentSum: 0, count: 0, keywords: [] };
      return {
        lang,
        name: LANG_NAMES[lang] ?? lang,
        reviews,
        pct: total > 0 ? Math.round((reviews / total) * 100 * 10) / 10 : 0,
        avgRate: s.count > 0 ? Math.round(s.sentimentSum / s.count) : 0,
        keywords: s.keywords,
      };
    });
  }, [timelineRows, languageDistribution]);

  // ── 2. 파이 차트 데이터: 상위 PIE_TOP_N + 기타 ─────────────────────
  const pieData = useMemo(() => {
    if (stats.length === 0) return [];
    if (stats.length <= PIE_TOP_N) return stats.map((s) => ({ name: s.name, value: s.reviews }));

    const top = stats.slice(0, PIE_TOP_N);
    const rest = stats.slice(PIE_TOP_N);
    const otherReviews = rest.reduce((sum, s) => sum + s.reviews, 0);
    return [
      ...top.map((s) => ({ name: s.name, value: s.reviews })),
      { name: "기타", value: otherReviews },
    ];
  }, [stats]);

  if (stats.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-text-muted text-sm">
        언어별 데이터가 없습니다.
      </div>
    );
  }

  const total = stats.reduce((s, r) => s + r.reviews, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 파이 차트 — 상위 5개 + 기타 */}
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">언어권별 리뷰 비중</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                nameKey="name"
                label={({ name, value }) => {
                  const pct = total > 0 ? Math.round((value / total) * 100 * 10) / 10 : 0;
                  return `${name} ${pct}%`;
                }}
                labelLine={{ stroke: "#3d4460" }}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#1e2130", border: "1px solid #2a2f45", borderRadius: 8, color: "#e8eaf0" }}
                formatter={(v: number, name: string) => {
                  const pct = total > 0 ? Math.round((v / total) * 100 * 10) / 10 : 0;
                  return [`${v.toLocaleString()}건 (${pct}%)`, name];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 언어별 상세 리스트 — 전체 언어 표시 */}
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">언어별 평가 및 키워드</h3>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {stats.map((s) => (
              <div key={s.lang} className="bg-bg-card border border-border-default rounded-lg px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{s.name}</span>
                    <span className="text-xs text-text-muted">{s.pct}%</span>
                    {s.avgRate === 0 && s.keywords.length === 0 && (
                      <span className="text-xs text-text-muted opacity-50">(미분석)</span>
                    )}
                  </div>
                  {s.avgRate > 0 && <Badge rate={s.avgRate} reviewCount={s.reviews} size="sm" />}
                </div>
                {s.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {s.keywords.map((kw, ki) => (
                      <span key={ki} className="text-xs bg-bg-secondary px-2 py-0.5 rounded text-text-secondary">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {crossAnalysisComment && (
        <div className="bg-bg-card border border-accent-blue/20 rounded-lg px-4 py-3">
          <p className="text-xs text-accent-blue mb-1">AI 언어권 교차 분석</p>
          <p className="text-sm text-text-secondary leading-relaxed">{crossAnalysisComment}</p>
        </div>
      )}
    </div>
  );
}
