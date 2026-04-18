"use client";
import { useState, useMemo } from "react";
import Badge from "@/components/shared/Badge";
import type { TimelineRow, TopReview } from "@/types";

interface TimelineProps {
  timelineRows: TimelineRow[];
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  official: "공식 패치",
  manual: "수동 이벤트",
  news: "외부 뉴스",
  free_weekend: "무료 주말",
  launch: "런칭",
};

export default function Timeline({ timelineRows }: TimelineProps) {
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const allRows = useMemo(() => {
    return timelineRows.filter((r) => r.language_scope === "all");
  }, [timelineRows]);

  const sorted = useMemo(() => {
    return [...allRows].sort((a, b) =>
      sortAsc
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date)
    );
  }, [allRows, sortAsc]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function parseKeywords(raw: string): string[] {
    try { return JSON.parse(raw) ?? []; } catch { return []; }
  }

  function parseReviews(raw: string): TopReview[] {
    try { return JSON.parse(raw) ?? []; } catch { return []; }
  }

  return (
    <div>
      {/* 정렬 토글 */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="text-xs px-3 py-1.5 bg-bg-card border border-border-default rounded-lg text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors"
        >
          {sortAsc ? "▲ 과거순" : "▼ 최신순"}
        </button>
      </div>

      <div className="relative">
        {/* 세로 축 */}
        <div className="absolute left-[7px] top-0 bottom-0 w-0.5 bg-border-default" />

        <div className="space-y-0">
          {sorted.map((row) => {
            const isNews = row.event_type === "news";
            const isSale = row.is_sale_period === "TRUE" || row.is_sale_period === true;
            const isFreeWeekend = row.is_free_weekend === "TRUE" || row.is_free_weekend === true;
            const isExpanded = expandedIds.has(row.event_id);
            const rate = row.sentiment_rate !== "" && row.sentiment_rate !== 0 ? Number(row.sentiment_rate) : null;
            const keywords = parseKeywords(row.top_keywords);
            const reviews = parseReviews(row.top_reviews);
            // AI 분석 대기 중 — 이벤트는 있지만 아직 분석 안 된 상태
            const isPending = !isNews && rate === null && keywords.length === 0 && !row.ai_reaction_summary;

            if (isNews) {
              return (
                <div key={row.event_id} className="flex gap-4 py-2 ml-0">
                  <div className="relative shrink-0 mt-1">
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-text-muted bg-bg-primary" />
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-text-muted">{row.date}</span>
                      <span className="text-xs bg-bg-card px-1.5 py-0.5 rounded text-text-muted border border-border-default">외부 뉴스</span>
                      {row.url ? (
                        <a href={row.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-text-secondary hover:text-accent-blue transition-colors line-clamp-1">
                          {row.title} ↗
                        </a>
                      ) : (
                        <span className="text-xs text-text-secondary">{row.title}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={row.event_id}
                className={`flex gap-4 py-3 ${isSale ? "bg-accent-orange/5" : isFreeWeekend ? "bg-accent-green/5" : ""}`}
              >
                <div className="relative shrink-0 mt-2">
                  <div className={`w-3.5 h-3.5 rounded-full border-2 ${
                    isFreeWeekend ? "border-accent-green bg-accent-green/30" :
                    isSale ? "border-accent-orange bg-accent-orange/30" :
                    "border-accent-blue bg-accent-blue/30"
                  }`} />
                </div>

                <div className="flex-1 pb-3">
                  {/* 할인 뱃지 */}
                  {(isSale || isFreeWeekend) && (
                    <div className="mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        isFreeWeekend
                          ? "bg-accent-green/20 text-accent-green border border-accent-green/30"
                          : "bg-accent-orange/20 text-accent-orange border border-accent-orange/30"
                      }`}>
                        {isFreeWeekend ? "무료 주말" : row.sale_text || "할인 중"}
                      </span>
                    </div>
                  )}

                  {/* 헤더 클릭 → 접기/펼치기 */}
                  <button
                    onClick={() => !isPending && toggleExpand(row.event_id)}
                    className={`w-full text-left ${isPending ? "cursor-default" : "group"}`}
                    disabled={isPending}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-text-muted">{row.date}</span>
                      <span className="text-xs bg-bg-secondary border border-border-default px-1.5 py-0.5 rounded text-text-muted">
                        {EVENT_TYPE_LABELS[row.event_type] ?? row.event_type}
                      </span>
                      {isPending ? (
                        <span className="text-xs text-text-muted flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-yellow animate-pulse" />
                          AI 분석 진행 중...
                        </span>
                      ) : (
                        rate !== null && <Badge rate={rate} size="sm" />
                      )}
                    </div>
                    <p className={`font-medium mt-1 transition-colors ${isPending ? "text-text-secondary" : "text-text-primary group-hover:text-accent-blue"}`}>
                      {row.title}
                      {!isPending && <span className="ml-2 text-xs text-text-muted">{isExpanded ? "▲" : "▼"}</span>}
                    </p>

                    {/* 기본 표시: 키워드 */}
                    {!isPending && keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {keywords.map((kw, ki) => (
                          <span key={ki} className="text-xs bg-bg-secondary px-2 py-0.5 rounded text-text-secondary border border-border-default">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>

                  {/* 펼침 상세 */}
                  {isExpanded && (
                    <div className="mt-3 space-y-3 border-l-2 border-accent-blue/30 pl-4">
                      {row.ai_patch_summary && (
                        <div>
                          <p className="text-xs text-accent-blue mb-1 font-medium">패치 내용 요약</p>
                          <p className="text-sm text-text-secondary leading-relaxed">{row.ai_patch_summary}</p>
                        </div>
                      )}
                      {row.ai_reaction_summary && (
                        <div>
                          <p className="text-xs text-accent-blue mb-1 font-medium">유저 반응 진단</p>
                          <p className="text-sm text-text-secondary leading-relaxed">{row.ai_reaction_summary}</p>
                        </div>
                      )}
                      {row.review_count && (
                        <p className="text-xs text-text-muted">
                          해당 구간 수집 리뷰: {Number(row.review_count).toLocaleString()}건
                        </p>
                      )}
                      {reviews.length > 0 && (
                        <div>
                          <p className="text-xs text-accent-blue mb-2 font-medium">핵심 대표 리뷰</p>
                          <div className="space-y-2">
                            {reviews.slice(0, 3).map((rv, ri) => (
                              <div key={ri} className={`bg-bg-primary border rounded-lg p-3 ${rv.voted_up ? "border-accent-green/20" : "border-accent-red/20"}`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-xs font-medium ${rv.voted_up ? "text-accent-green" : "text-accent-red"}`}>
                                    {rv.voted_up ? "긍정" : "부정"}
                                  </span>
                                  <span className="text-xs text-text-muted">[{rv.language}]</span>
                                </div>
                                {rv.language !== "koreana" && rv.text !== rv.text_kr && (
                                  <p className="text-xs text-text-muted mb-1">{rv.text}</p>
                                )}
                                <p className="text-sm text-text-secondary">{rv.text_kr || rv.text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {row.url && (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-xs px-3 py-1.5 bg-bg-secondary border border-border-default rounded-lg text-accent-blue hover:bg-bg-hover transition-colors"
                        >
                          공식 패치노트 원문 보기 ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
