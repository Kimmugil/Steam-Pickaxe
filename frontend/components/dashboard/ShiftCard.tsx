"use client";
import { useState } from "react";
import type { TimelineRow, TopReview } from "@/types";

interface ShiftCardProps {
  shift: TimelineRow;
  linkedEvents: TimelineRow[];
}

export default function ShiftCard({ shift, linkedEvents }: ShiftCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isDecline   = shift.direction === "decline";
  const before      = Number(shift.sentiment_before ?? 0);
  const after       = Number(shift.sentiment_rate   ?? 0);
  const delta       = Number(shift.sentiment_delta  ?? 0);
  const reviewCount = Number(shift.review_count     ?? 0);
  const confidence  = shift.confidence ?? "low";
  const isConfirmed = shift.is_official_confirmed === "true";
  const isRefuted   = shift.is_official_confirmed === "false";

  const dateLabel = shift.date_end && shift.date_end !== shift.date
    ? `${shift.date} – ${shift.date_end}`
    : shift.date;

  const reviews: TopReview[] = (() => {
    try { return JSON.parse(shift.top_reviews || "[]") ?? []; } catch { return []; }
  })();

  const CONFIDENCE_LABEL: Record<string, string> = {
    high:   "신뢰도 높음",
    medium: "신뢰도 보통",
    low:    "데이터 부족",
  };
  const CONFIDENCE_COLOR: Record<string, string> = {
    high:   "text-accent-green border-accent-green/30 bg-accent-green/10",
    medium: "text-accent-yellow border-accent-yellow/30 bg-accent-yellow/10",
    low:    "text-text-muted border-border-default bg-bg-secondary",
  };

  return (
    <div className={`rounded-xl border overflow-hidden ${
      isDecline
        ? "border-accent-red/30 bg-accent-red/5"
        : "border-accent-green/30 bg-accent-green/5"
    }`}>
      {/* 헤더 — 클릭으로 펼침 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/10 transition-colors"
      >
        {/* 아이콘 */}
        <span className="text-base shrink-0">{isDecline ? "📉" : "📈"}</span>

        {/* 타입 배지 */}
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold shrink-0 ${
          isDecline
            ? "text-accent-red border-accent-red/40 bg-accent-red/10"
            : "text-accent-green border-accent-green/40 bg-accent-green/10"
        }`}>
          {isDecline ? "평가 급락 감지" : "평가 회복 감지"}
        </span>

        {/* 날짜 범위 */}
        <span className="text-xs text-text-muted shrink-0">{dateLabel}</span>

        {/* 변화폭 */}
        <span className={`text-xs font-semibold shrink-0 ${isDecline ? "text-accent-red" : "text-accent-green"}`}>
          {before.toFixed(1)}% → {after.toFixed(1)}%
          <span className="ml-1 font-normal">({delta > 0 ? "+" : ""}{delta.toFixed(1)}pp)</span>
        </span>

        {/* 오른쪽: 신뢰도 + 공식확인 + 토글 */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CONFIDENCE_COLOR[confidence]}`}>
            {CONFIDENCE_LABEL[confidence]}
          </span>
          {isConfirmed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border text-accent-blue border-accent-blue/30 bg-accent-blue/10">
              공식확인
            </span>
          )}
          {isRefuted && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border text-text-muted border-border-default bg-bg-secondary">
              게임외이슈 가능성
            </span>
          )}
          <span className="text-text-muted text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* 펼침 영역 */}
      {expanded && (
        <div className="border-t border-border-default/30 px-4 py-4 space-y-4 bg-bg-primary/60">
          {/* 리뷰 수 */}
          <p className="text-xs text-text-muted">
            해당 구간 리뷰 {reviewCount.toLocaleString()}건 분석
          </p>

          {/* AI 원인 추정 */}
          {shift.ai_reaction_summary && (
            <div>
              <p className="text-xs font-medium mb-1 text-text-muted">AI 추정 원인</p>
              <p className="text-sm text-text-secondary leading-relaxed">
                {shift.ai_reaction_summary}
              </p>
            </div>
          )}

          {/* 연결된 공식 이벤트 */}
          {linkedEvents.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1.5 text-text-muted">근방 공식 이벤트</p>
              <div className="space-y-1">
                {linkedEvents.map((ev) => (
                  <div key={ev.event_id} className="flex items-center gap-2">
                    <span className="text-xs text-text-muted shrink-0">{ev.date}</span>
                    {ev.url ? (
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent-blue hover:underline truncate"
                      >
                        {ev.title_kr || ev.title} ↗
                      </a>
                    ) : (
                      <span className="text-xs text-text-secondary truncate">
                        {ev.title_kr || ev.title}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 대표 리뷰 */}
          {reviews.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2 text-text-muted">이슈 관련 주요 리뷰</p>
              <div className="space-y-2">
                {reviews.slice(0, 3).map((rv, ri) => (
                  <div
                    key={ri}
                    className={`bg-bg-card border rounded-lg p-3 ${
                      rv.voted_up ? "border-accent-green/20" : "border-accent-red/20"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium ${rv.voted_up ? "text-accent-green" : "text-accent-red"}`}>
                        {rv.voted_up ? "👍 긍정" : "👎 부정"}
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
        </div>
      )}
    </div>
  );
}
