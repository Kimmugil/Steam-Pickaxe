"use client";
import { useState } from "react";
import type { TimelineRow, TopReview } from "@/types";
import { useUiText } from "@/contexts/UiTextContext";



interface ShiftCardProps {
  shift: TimelineRow;
  linkedEvents: TimelineRow[];
}

export default function ShiftCard({ shift, linkedEvents }: ShiftCardProps) {
  const { t } = useUiText();
  const [expanded, setExpanded] = useState(false);
  const [eventsExpanded, setEventsExpanded] = useState(false);

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
    high:   t("SHIFT_CONFIDENCE_HIGH"),
    medium: t("SHIFT_CONFIDENCE_MEDIUM"),
    low:    t("SHIFT_CONFIDENCE_LOW"),
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
          {isDecline ? t("SHIFT_TYPE_DECLINE") : t("SHIFT_TYPE_RISE")}
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
              {t("SHIFT_CONFIRMED")}
            </span>
          )}
          {isRefuted && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border text-text-muted border-border-default bg-bg-secondary">
              {t("SHIFT_REFUTED")}
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
            {t("SHIFT_REVIEW_COUNT", { count: reviewCount.toLocaleString() })}
          </p>

          {/* AI 원인 추정 */}
          {shift.ai_reaction_summary && (
            <div>
              <p className="text-xs font-medium mb-1 text-text-muted">{t("SHIFT_AI_CAUSE_LABEL")}</p>
              <p className="text-sm text-text-secondary leading-relaxed">
                {shift.ai_reaction_summary}
              </p>
            </div>
          )}

          {/* 이슈 관련 주요 리뷰 */}
          {reviews.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2 text-text-muted">{t("SHIFT_TOP_REVIEWS_LABEL")}</p>
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
                        {rv.voted_up ? t("SHIFT_REVIEW_POSITIVE") : t("SHIFT_REVIEW_NEGATIVE")}
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

          {/* 근방 공식 이벤트 (토글 접힘) */}
          {linkedEvents.length > 0 && (
            <div className="border border-border-default/40 rounded-lg overflow-hidden">
              <button
                onClick={() => setEventsExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-bg-secondary/40 transition-colors"
              >
                <span className="text-xs font-medium text-text-muted">{t("SHIFT_LINKED_EVENTS_LABEL")}</span>
                <span className="flex items-center gap-1.5 text-xs text-text-muted">
                  <span className="text-text-primary font-semibold">
                    {t("SHIFT_LINKED_EVENTS_COUNT", { n: String(linkedEvents.length) })}
                  </span>
                  <span className="text-[10px]">{eventsExpanded ? "▲" : "▼"}</span>
                </span>
              </button>
              {eventsExpanded && (
                <div className="border-t border-border-default/30 px-3 py-2 space-y-1.5">
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
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
