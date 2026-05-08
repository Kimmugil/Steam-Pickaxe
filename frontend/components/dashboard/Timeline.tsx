"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import Badge from "@/components/shared/Badge";
import Toast, { useToast } from "@/components/shared/Toast";
import ShiftCard from "@/components/dashboard/ShiftCard";
import type { TimelineRow, TopReview } from "@/types";

interface TimelineProps {
  timelineRows: TimelineRow[];
  appid: string;
  releaseDate?: string;
  focusYm?: string;
  focusTab?: string;
}

// ── 이벤트 수정 모달 ─────────────────────────────────────────────────────────
function EditEventModal({
  row, appid, onClose, onSaved,
}: {
  row: TimelineRow; appid: string; onClose: () => void; onSaved: () => void;
}) {
  const [titleKr, setTitleKr]   = useState(row.title_kr ?? "");
  const [eventType, setEventType] = useState<string>(row.event_type ?? "official");
  const [date, setDate]           = useState(row.date ?? "");
  const [pw, setPw]               = useState("");
  const [triggerReanalyze, setTriggerReanalyze] = useState(false);
  const [loading, setLoading]     = useState(false);
  const { toast, show, clear }    = useToast();

  async function handleSave() {
    if (!pw) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/event", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appid, event_id: row.event_id,
          updates: { title_kr: titleKr, event_type: eventType, date },
          password: pw, trigger_reanalyze: triggerReanalyze,
        }),
      });
      const data = await res.json();
      if (data.ok) { show("이벤트가 수정되었습니다.", "success"); setTimeout(onSaved, 1200); }
      else show(data.error ?? "오류가 발생했습니다.", "error");
    } finally { setLoading(false); }
  }

  const EVENT_TYPE_OPTIONS = [
    { value: "official", label: "공식 이벤트" },
    { value: "manual",   label: "직접 등록" },
    { value: "news",     label: "뉴스" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-card border border-border-default rounded-xl p-6 w-96 max-w-[calc(100vw-2rem)]">
        <p className="font-semibold mb-1">{"이벤트 수정"}</p>
        <p className="text-xs text-text-muted mb-4">
          {"원본 제목:"}{" "}
          <span className="text-text-secondary">{row.title}</span>
        </p>
        <label className="block text-xs text-text-muted mb-1">{"한국어 제목"}</label>
        <input type="text" value={titleKr} onChange={(e) => setTitleKr(e.target.value)}
          placeholder={"한국어 제목 입력"}
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue mb-3" />
        <label className="block text-xs text-text-muted mb-1">{"이벤트 유형"}</label>
        <select value={eventType} onChange={(e) => setEventType(e.target.value)}
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue mb-3">
          {EVENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <label className="block text-xs text-text-muted mb-1">{"날짜"}</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue mb-3" />
        <label className="flex items-center gap-2 text-xs text-text-secondary mb-4 cursor-pointer select-none">
          <input type="checkbox" checked={triggerReanalyze} onChange={(e) => setTriggerReanalyze(e.target.checked)} className="accent-accent-blue" />
          {"저장 후 AI 재분석 트리거"}
        </label>
        <label className="block text-xs text-text-muted mb-1">{"관리자 비밀번호"}</label>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
          placeholder={"비밀번호 입력"}
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue mb-3"
          onKeyDown={(e) => e.key === "Enter" && !loading && pw && handleSave()} autoFocus />
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={loading || !pw}
            className="flex-1 py-2 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue rounded-lg text-sm disabled:opacity-40">
            {loading ? "저장 중..." : "저장"}
          </button>
          <button onClick={onClose} className="flex-1 py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover">
            {"닫기"}
          </button>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}

// ── 개별 이벤트 행 ────────────────────────────────────────────────────────────
function EventItem({
  row, appid, onEdit,
}: { row: TimelineRow; appid: string; onEdit: (r: TimelineRow) => void; }) {
  const [expanded, setExpanded] = useState(false);

  const isNews       = row.event_type === "news";
  const isFreeWeekend = row.is_free_weekend === "TRUE" || row.is_free_weekend === true;
  const isSale        = row.is_sale_period  === "TRUE" || row.is_sale_period  === true;
  const hasPatch      = !!row.ai_patch_summary;

  const TYPE_COLORS: Record<string, string> = {
    official:    "text-accent-blue border-accent-blue/30 bg-accent-blue/10",
    manual:      "text-accent-blue border-accent-blue/30 bg-accent-blue/10",
    news:        "text-text-muted border-border-default bg-bg-secondary",
    free_weekend:"text-accent-green border-accent-green/30 bg-accent-green/10",
  };
  const typeColor = TYPE_COLORS[row.event_type] ?? "text-text-muted border-border-default bg-bg-secondary";

  const TYPE_LABELS: Record<string, string> = {
    official:     "공식 이벤트",
    manual:       "직접 등록",
    news:         "뉴스",
    free_weekend: "무료 주말",
  };

  return (
    <div className={`group/item flex gap-3 py-2 ${isSale ? "bg-accent-orange/5 rounded" : ""}`}>
      {/* 타임라인 점 */}
      <div className="shrink-0 mt-1.5">
        <div className={`w-2 h-2 rounded-full border ${
          isFreeWeekend ? "border-accent-green bg-accent-green/40" :
          isSale        ? "border-accent-orange bg-accent-orange/40" :
          isNews        ? "border-border-default bg-bg-secondary" :
          "border-accent-blue bg-accent-blue/40"
        }`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-xs text-text-muted shrink-0">{row.date}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${typeColor}`}>
            {TYPE_LABELS[row.event_type] ?? row.event_type}
          </span>
          {row.url ? (
            <a href={row.url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-text-secondary hover:text-accent-blue truncate max-w-xs transition-colors">
              {row.title_kr || row.title} ↗
            </a>
          ) : (
            <span className="text-xs text-text-secondary truncate max-w-xs">
              {row.title_kr || row.title}
            </span>
          )}
          {/* 기존 개별 patch summary 있으면 펼치기 */}
          {hasPatch && (
            <button onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-text-muted hover:text-accent-blue">
              {expanded ? "▲" : "▼"}
            </button>
          )}
        </div>
        {/* 수정 버튼 */}
        {!isNews && (
          <button onClick={() => onEdit(row)}
            className="text-[10px] text-text-muted opacity-0 group-hover/item:opacity-100 hover:text-accent-blue transition-all mt-0.5">
            {"수정"}

          </button>
        )}
        {/* 개별 patch summary 펼침 */}
        {expanded && hasPatch && (
          <div className="mt-2 border-l-2 border-accent-blue/20 pl-3">
            <p className="text-xs text-accent-blue mb-1 font-medium">{"패치 요약"}</p>
            <p className="text-xs text-text-secondary leading-relaxed">{row.ai_patch_summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 주간 카드 (출시 초기 세분화 분석) ──────────────────────────────────────
function WeeklyCard({ row }: { row: TimelineRow }) {
  const [expanded, setExpanded] = useState(false);

  const isSparse  = String(row.sentiment_rate) === "sparse";
  const isPending = row.sentiment_rate === "" || row.sentiment_rate == null;
  const rate      = (!isSparse && !isPending) ? Number(row.sentiment_rate) : null;
  const reviewCount = Number(row.review_count || 0);

  const keywords: string[] = (() => {
    try { return JSON.parse(row.top_keywords || "[]") ?? []; } catch { return []; }
  })();
  const reviews: TopReview[] = (() => {
    try { return JSON.parse(row.top_reviews || "[]") ?? []; } catch { return []; }
  })();

  const dateLabel = row.date_end && row.date_end !== row.date
    ? `${row.date} – ${row.date_end}`
    : row.date;

  return (
    <div className="border border-accent-blue/20 rounded-lg overflow-hidden bg-accent-blue/3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-bg-card hover:bg-bg-secondary transition-colors text-left"
      >
        <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold shrink-0 text-accent-blue border-accent-blue/40 bg-accent-blue/10">
          {"주간 분석"}
        </span>
        <span className="text-xs font-medium text-text-primary shrink-0">{row.title}</span>
        <span className="text-[10px] text-text-muted shrink-0">{dateLabel}</span>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {isPending ? (
            <span className="text-[10px] text-text-muted px-1.5 py-0.5 bg-bg-secondary border border-border-default rounded">
              {"분석 대기"}
            </span>
          ) : isSparse ? (
            <span className="text-[10px] text-text-muted px-1.5 py-0.5 bg-bg-secondary border border-border-default rounded">
              {"리뷰 부족"}
            </span>
          ) : rate !== null ? (
            <Badge rate={rate} reviewCount={reviewCount} size="sm" labelOnly />
          ) : null}
          <span className="text-text-muted text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && !isPending && !isSparse && (
        <div className="border-t border-border-default/30 px-3 py-3 space-y-3 bg-bg-primary/60">
          {reviewCount > 0 && (
            <p className="text-xs text-text-muted">
              {`리뷰 ${reviewCount.toLocaleString()}건`}
            </p>
          )}
          {row.ai_reaction_summary && (
            <div>
              <p className="text-xs font-medium mb-1 text-text-muted">{"유저 반응"}</p>
              <p className="text-sm text-text-secondary leading-relaxed">{row.ai_reaction_summary}</p>
            </div>
          )}
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {keywords.map((kw, ki) => (
                <span key={ki} className="text-xs bg-bg-secondary px-2 py-0.5 rounded text-text-secondary border border-border-default">
                  {kw}
                </span>
              ))}
            </div>
          )}
          {reviews.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1.5 text-text-muted">{"대표 리뷰"}</p>
              <div className="space-y-2">
                {reviews.slice(0, 3).map((rv, ri) => (
                  <div key={ri} className={`bg-bg-card border rounded-lg p-2.5 ${rv.voted_up ? "border-accent-green/20" : "border-accent-red/20"}`}>
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
        </div>
      )}
    </div>
  );
}

// ── 월별 카드 ────────────────────────────────────────────────────────────────
function MonthCard({
  summaryRow, eventRows, sortAsc, appid, onEdit, releaseYm, hasShift, shiftRows, eventById, weeklyRows,
  focusYm, focusTab,
}: {
  summaryRow: TimelineRow | null;
  eventRows: TimelineRow[];
  sortAsc: boolean;
  appid: string;
  onEdit: (r: TimelineRow) => void;
  releaseYm?: string;
  hasShift?: boolean;
  shiftRows?: TimelineRow[];
  eventById?: Record<string, TimelineRow>;
  weeklyRows?: TimelineRow[];
  focusYm?: string;
  focusTab?: string;
}) {
  // 제목은 summaryRow가 없으면 eventRows의 첫 날짜로부터 추정 (ym 계산을 state 초기값 이전에)
  const firstDateEarly = eventRows[0]?.date ?? "";
  const ymEarly = (summaryRow?.date ?? firstDateEarly).slice(0, 7);
  const isFocused = !!focusYm && ymEarly === focusYm;

  const [expanded, setExpanded] = useState(() => isFocused);
  const [activeTab, setActiveTab] = useState<string | null>(() => isFocused && focusTab ? focusTab : null);
  const cardRef = useRef<HTMLDivElement>(null);

  // 딥링크(초기 진입) 또는 차트 마커 클릭 시: 카드 열기 + 탭 전환 + 스크롤
  useEffect(() => {
    if (!isFocused) return;
    setExpanded(true);
    if (focusTab) setActiveTab(focusTab);
    setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  // focusYm이 바뀔 때마다 반응 (차트 마커 클릭 포함)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusYm]);

  // ym은 위에서 이미 ymEarly로 계산됨 (state 초기값에 사용)
  const ym = ymEarly;
  const [year, month] = ym ? ym.split("-").map(Number) : [0, 0];
  const monthLabel = year && month ? `${year}년 ${month.toString().padStart(2, "0")}월` : "—";

  const isSparse  = summaryRow ? String(summaryRow.sentiment_rate) === "sparse" : false;
  const isPending = !summaryRow || (summaryRow.sentiment_rate === "" || summaryRow.sentiment_rate == null);
  const rate      = (!isSparse && !isPending && summaryRow)
    ? Number(summaryRow.sentiment_rate)
    : null;
  const reviewCount = summaryRow ? Number(summaryRow.review_count || 0) : 0;

  const keywords: string[] = (() => {
    try { return summaryRow ? JSON.parse(summaryRow.top_keywords || "[]") ?? [] : []; } catch { return []; }
  })();

  const reviews: TopReview[] = (() => {
    try { return summaryRow ? JSON.parse(summaryRow.top_reviews || "[]") ?? [] : []; } catch { return []; }
  })();

  const officialCount = eventRows.filter(r => r.event_type === "official" || r.event_type === "manual").length;
  const externalCount = eventRows.filter(r => r.event_type === "news" || r.event_type === "free_weekend").length;

  const sortedEvents = [...eventRows].sort((a, b) =>
    sortAsc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
  );

  // ── 탭 구성 ───────────────────────────────────────────────────────────────
  const hasAnalysis  = !isPending && !isSparse && !!summaryRow &&
    (!!summaryRow.ai_patch_summary || !!summaryRow.ai_reaction_summary);
  const hasReviews   = reviews.length > 0;
  const hasWeekly    = !!weeklyRows && weeklyRows.length > 0;
  const hasShiftData = !!shiftRows && shiftRows.length > 0;

  type TabId = "analysis" | "reviews" | "events" | "weekly" | "shift";
  const tabs: { id: TabId; label: string; badge?: string }[] = [
    ...(hasAnalysis ? [{ id: "analysis" as TabId, label: "AI 분석" }] : []),
    ...(hasReviews  ? [{ id: "reviews"  as TabId, label: "대표 리뷰" }] : []),
    { id: "events" as TabId, label: "이벤트", badge: sortedEvents.length > 0 ? String(sortedEvents.length) : undefined },
    ...(hasWeekly    ? [{ id: "weekly" as TabId, label: "주간 분석", badge: String(weeklyRows!.length) }] : []),
    ...(hasShiftData ? [{ id: "shift"  as TabId, label: "급변 감지" }] : []),
  ];

  const defaultTab: TabId = hasAnalysis ? "analysis" : hasReviews ? "reviews" : "events";
  const currentTab = (activeTab ?? defaultTab) as TabId;

  return (
    <div ref={cardRef} className="border border-border-default rounded-xl overflow-hidden">
      {/* 월 카드 헤더 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-bg-card hover:bg-bg-secondary transition-colors text-left"
      >
        {/* 타임라인 점 */}
        <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${
          isPending ? "border-accent-yellow bg-accent-yellow/20" :
          isSparse  ? "border-border-default bg-bg-secondary" :
          "border-accent-blue bg-accent-blue/30"
        }`} />

        {/* 월 레이블 */}
        <span className="font-semibold text-text-primary text-sm">{monthLabel}</span>

        {/* 이벤트 수 뱃지 */}
        <span className="text-xs text-text-muted">
          {[
            officialCount > 0 && `공식 ${officialCount}건`,
            externalCount > 0 && `외부 ${externalCount}건`,
          ].filter(Boolean).join(" · ") || "이벤트 없음"}
        </span>

        {/* 출시 마커 */}
        {releaseYm && ym === releaseYm && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium text-accent-green border-accent-green/40 bg-accent-green/10 shrink-0">
            {"출시"}
          </span>
        )}

        {/* 주간 분석 배지 */}
        {weeklyRows && weeklyRows.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium text-accent-blue border-accent-blue/30 bg-accent-blue/10 shrink-0">
            {"주간 분석 있음"}
          </span>
        )}

        {/* 급변 감지 배지 */}
        {hasShift && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium text-accent-yellow border-accent-yellow/40 bg-accent-yellow/10 shrink-0">
            {"급변 감지"}
          </span>
        )}

        {/* 오른쪽: 상태 배지 + 토글 화살표 */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {isPending ? (
            <span className="text-xs text-text-muted px-2 py-0.5 bg-bg-secondary border border-border-default rounded">
              {"분석 대기"}
            </span>
          ) : isSparse ? (
            <span className="text-xs text-text-muted px-2 py-0.5 bg-bg-secondary border border-border-default rounded">
              {"리뷰 부족"}
            </span>
          ) : rate !== null ? (
            <Badge rate={rate} reviewCount={reviewCount} size="sm" labelOnly />
          ) : null}
          <span className="text-text-muted text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* 펼침 영역 */}
      {expanded && (
        <div className="border-t border-border-default bg-bg-primary">

          {/* ── 탭 바 ──────────────────────────────────────────────────────── */}
          <div className="flex border-b border-border-default bg-bg-card overflow-x-auto">
            {tabs.map((tab) => {
              const isShift  = tab.id === "shift";
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                    isShift
                      ? isActive
                        ? "border-accent-yellow text-accent-yellow bg-accent-yellow/5"
                        : "border-transparent text-accent-yellow/80 hover:border-accent-yellow/50 hover:bg-accent-yellow/5"
                      : isActive
                        ? "border-accent-blue text-accent-blue"
                        : "border-transparent text-text-muted hover:text-text-secondary hover:border-border-default"
                  }`}
                >
                  {isShift && <span>⚡</span>}
                  {tab.label}
                  {tab.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-bg-secondary border border-border-default rounded-full text-text-muted">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── 탭 콘텐츠 ──────────────────────────────────────────────────── */}
          <div className="p-4">

            {/* AI 분석 탭 */}
            {currentTab === "analysis" && hasAnalysis && summaryRow && (
              <div className="space-y-4">
                {/* 리뷰 수 + 키워드 */}
                {(reviewCount > 0 || keywords.length > 0) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    {reviewCount > 0 && (
                      <span className="text-xs text-text-muted shrink-0">
                        {`리뷰 ${reviewCount.toLocaleString()}건`}
                      </span>
                    )}
                    {keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {keywords.map((kw, ki) => (
                          <span key={ki} className="text-xs bg-bg-secondary px-2 py-0.5 rounded border border-border-default text-text-secondary">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* 패치 요약 + 유저 반응 — 2열 카드 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {summaryRow.ai_patch_summary && (
                    <div className="bg-bg-card border border-border-default rounded-lg p-4">
                      <p className="text-xs font-semibold text-accent-blue mb-2">{"패치 요약"}</p>
                      <p className="text-sm text-text-secondary leading-relaxed">{summaryRow.ai_patch_summary}</p>
                    </div>
                  )}
                  {summaryRow.ai_reaction_summary && (
                    <div className="bg-bg-card border border-border-default rounded-lg p-4">
                      <p className="text-xs font-semibold text-accent-blue mb-2">{"유저 반응"}</p>
                      <p className="text-sm text-text-secondary leading-relaxed">{summaryRow.ai_reaction_summary}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 대표 리뷰 탭 — 3열 그리드 */}
            {currentTab === "reviews" && reviews.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {reviews.map((rv, ri) => (
                  <div
                    key={ri}
                    className={`bg-bg-card border rounded-lg p-3 flex flex-col gap-2 ${
                      rv.voted_up ? "border-accent-green/20" : "border-accent-red/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${rv.voted_up ? "text-accent-green" : "text-accent-red"}`}>
                        {rv.voted_up ? "긍정" : "부정"}
                      </span>
                      <span className="text-xs text-text-muted">[{rv.language}]</span>
                    </div>
                    {rv.language !== "koreana" && rv.text !== rv.text_kr && (
                      <p className="text-xs text-text-muted leading-relaxed line-clamp-3">{rv.text}</p>
                    )}
                    <p className="text-sm text-text-secondary leading-relaxed">{rv.text_kr || rv.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 이벤트 탭 */}
            {currentTab === "events" && (
              <div className="space-y-0">
                {sortedEvents.length === 0 ? (
                  <p className="text-xs text-text-muted py-2">{"이번 달 이벤트 없음"}</p>
                ) : (
                  sortedEvents.map((row) => (
                    <EventItem key={row.event_id} row={row} appid={appid} onEdit={onEdit} />
                  ))
                )}
              </div>
            )}

            {/* 주간 분석 탭 — 1열 순서 리스트 */}
            {currentTab === "weekly" && weeklyRows && weeklyRows.length > 0 && (
              <div className="space-y-2">
                {[...weeklyRows]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((row) => (
                    <WeeklyCard key={row.event_id} row={row} />
                  ))}
              </div>
            )}

            {/* 급변 감지 탭 */}
            {currentTab === "shift" && shiftRows && shiftRows.length > 0 && (
              <div className="space-y-3">
                {shiftRows.map((shift) => {
                  const ids: string[] = (() => {
                    try { return JSON.parse(shift.linked_event_ids || "[]"); } catch { return []; }
                  })();
                  const linkedEvents = ids.map(id => eventById?.[id]).filter(Boolean) as TimelineRow[];
                  return (
                    <ShiftCard key={shift.event_id} shift={shift} linkedEvents={linkedEvents} />
                  );
                })}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function Timeline({ timelineRows, appid, releaseDate, focusYm, focusTab }: TimelineProps) {
  const [sortAsc, setSortAsc]     = useState(false);
  const [editingRow, setEditingRow] = useState<TimelineRow | null>(null);
  const { toast, show, clear }    = useToast();

  // sentiment_shift rows (별도 분리)
  const shiftRows = useMemo(
    () => timelineRows.filter(r => r.event_type === "sentiment_shift"),
    [timelineRows],
  );

  // 각 shift의 YYYY-MM → ShiftRow[] 맵
  const shiftsByYm = useMemo(() => {
    const map: Record<string, TimelineRow[]> = {};
    for (const r of shiftRows) {
      const ym = r.date?.slice(0, 7) ?? "";
      if (!ym) continue;
      map[ym] = map[ym] ?? [];
      map[ym].push(r);
    }
    return map;
  }, [shiftRows]);

  // shift에 연결된 공식 이벤트 조회 (linked_event_ids 기준)
  const eventById = useMemo(() => {
    const map: Record<string, TimelineRow> = {};
    for (const r of timelineRows) {
      if (r.event_id) map[r.event_id] = r;
    }
    return map;
  }, [timelineRows]);

  // monthly_summary rows (all scope)
  const summaryByYm = useMemo(() => {
    const map: Record<string, TimelineRow> = {};
    for (const r of timelineRows) {
      if (r.event_type === "monthly_summary" && r.language_scope === "all") {
        const ym = r.date?.slice(0, 7) ?? "";
        if (ym) map[ym] = r;
      }
    }
    return map;
  }, [timelineRows]);

  // weekly_summary rows (all scope) — 월 기준으로 그룹화
  const weeklyByYm = useMemo(() => {
    const map: Record<string, TimelineRow[]> = {};
    for (const r of timelineRows) {
      if (r.event_type === "weekly_summary" && r.language_scope === "all") {
        const ym = r.date?.slice(0, 7) ?? "";
        if (!ym) continue;
        map[ym] = map[ym] ?? [];
        map[ym].push(r);
      }
    }
    return map;
  }, [timelineRows]);

  // 개별 이벤트 rows (all scope, monthly_summary / weekly_summary / sentiment_shift 제외)
  const eventsByYm = useMemo(() => {
    const map: Record<string, TimelineRow[]> = {};
    for (const r of timelineRows) {
      if (r.language_scope !== "all") continue;
      if (r.event_type === "monthly_summary" || r.event_type === "weekly_summary" || r.event_type === "sentiment_shift") continue;
      const ym = r.date?.slice(0, 7) ?? "";
      if (!ym) continue;
      map[ym] = map[ym] ?? [];
      map[ym].push(r);
    }
    return map;
  }, [timelineRows]);

  // 출시 월 파싱 (예: "Apr 14, 2026" → "2026-04")
  const releaseYm = useMemo(() => {
    if (!releaseDate) return undefined;
    const d = new Date(releaseDate);
    if (isNaN(d.getTime())) return undefined;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [releaseDate]);

  // 모든 YYYY-MM 목록 (summary + event + weekly rows 합집합)
  const allYms = useMemo(() => {
    const yms = new Set([
      ...Object.keys(summaryByYm),
      ...Object.keys(eventsByYm),
      ...Object.keys(weeklyByYm),
    ]);
    return [...yms].sort((a, b) => sortAsc ? a.localeCompare(b) : b.localeCompare(a));
  }, [summaryByYm, eventsByYm, weeklyByYm, sortAsc]);

  if (allYms.length === 0) {
    return (
      <div className="text-center py-10 text-text-muted text-sm">
        {"타임라인 데이터 없음"}
      </div>
    );
  }

  return (
    <div>
      {/* 정렬 토글 */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="text-xs px-3 py-1.5 bg-bg-card border border-border-default rounded-lg text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors"
        >
          {sortAsc ? "오래된 순" : "최신 순"}
        </button>
      </div>

      <div className="space-y-2">
        {allYms.map((ym) => {
          const shiftsForYm  = shiftsByYm[ym]  ?? [];
          const weeklyForYm  = weeklyByYm[ym]  ?? [];
          return (
            <MonthCard
              key={ym}
              summaryRow={summaryByYm[ym] ?? null}
              eventRows={eventsByYm[ym] ?? []}
              sortAsc={sortAsc}
              appid={appid}
              onEdit={setEditingRow}
              releaseYm={releaseYm}
              hasShift={shiftsForYm.length > 0}
              shiftRows={shiftsForYm}
              eventById={eventById}
              weeklyRows={weeklyForYm.length > 0 ? weeklyForYm : undefined}
              focusYm={focusYm}
              focusTab={focusTab}
            />
          );
        })}
      </div>

      {editingRow && (
        <EditEventModal
          row={editingRow}
          appid={appid}
          onClose={() => setEditingRow(null)}
          onSaved={() => {
            setEditingRow(null);
            show("저장되었습니다.", "success");
          }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}
