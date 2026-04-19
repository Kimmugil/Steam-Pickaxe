"use client";
import { useState, useMemo } from "react";
import Badge from "@/components/shared/Badge";
import Toast, { useToast } from "@/components/shared/Toast";
import { useUiText } from "@/contexts/UiTextContext";
import type { TimelineRow, TopReview } from "@/types";

interface TimelineProps {
  timelineRows: TimelineRow[];
  appid: string;
}

// ── 이벤트 수정 모달 ───────────────────────────────────────────────────────────
function EditEventModal({
  row,
  appid,
  onClose,
  onSaved,
}: {
  row: TimelineRow;
  appid: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useUiText();
  const [titleKr, setTitleKr] = useState(row.title_kr ?? "");
  const [eventType, setEventType] = useState<string>(row.event_type ?? "official");
  const [date, setDate] = useState(row.date ?? "");
  const [pw, setPw] = useState("");
  const [triggerReanalyze, setTriggerReanalyze] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast, show, clear } = useToast();

  async function handleSave() {
    if (!pw) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/event", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appid,
          event_id: row.event_id,
          updates: { title_kr: titleKr, event_type: eventType, date },
          password: pw,
          trigger_reanalyze: triggerReanalyze,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        show(t("TIMELINE_EDIT_SUCCESS"), "success");
        setTimeout(onSaved, 1200);
      } else {
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } finally {
      setLoading(false);
    }
  }

  const EVENT_TYPE_OPTIONS = [
    { value: "official", label: t("TIMELINE_TYPE_OFFICIAL") },
    { value: "manual",   label: t("TIMELINE_TYPE_MANUAL") },
    { value: "news",     label: t("TIMELINE_TYPE_NEWS") },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-card border border-border-default rounded-xl p-6 w-96 max-w-[calc(100vw-2rem)]">
        <p className="font-semibold mb-1">{t("TIMELINE_EDIT_TITLE")}</p>
        <p className="text-xs text-text-muted mb-4">
          {t("TIMELINE_EDIT_ORIGINAL_TITLE_LABEL")}{" "}
          <span className="text-text-secondary">{row.title}</span>
        </p>

        {/* 한국어 제목 */}
        <label className="block text-xs text-text-muted mb-1">{t("TIMELINE_EDIT_TITLE_KR_LABEL")}</label>
        <input
          type="text"
          value={titleKr}
          onChange={(e) => setTitleKr(e.target.value)}
          placeholder={t("TIMELINE_EDIT_TITLE_KR_PLACEHOLDER")}
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue mb-3"
        />

        {/* 이벤트 유형 */}
        <label className="block text-xs text-text-muted mb-1">{t("TIMELINE_EDIT_TYPE_LABEL")}</label>
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue mb-3"
        >
          {EVENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* 날짜 */}
        <label className="block text-xs text-text-muted mb-1">{t("TIMELINE_EDIT_DATE_LABEL")}</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue mb-3"
        />

        {/* 재분석 옵션 */}
        <label className="flex items-center gap-2 text-xs text-text-secondary mb-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={triggerReanalyze}
            onChange={(e) => setTriggerReanalyze(e.target.checked)}
            className="accent-accent-blue"
          />
          {t("TIMELINE_EDIT_REANALYZE_LABEL")}
        </label>

        {/* 관리자 비밀번호 */}
        <label className="block text-xs text-text-muted mb-1">{t("ADMIN_PW_TITLE")}</label>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder={t("ADMIN_PW_PLACEHOLDER")}
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue mb-3"
          onKeyDown={(e) => e.key === "Enter" && !loading && pw && handleSave()}
          autoFocus
        />

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={loading || !pw}
            className="flex-1 py-2 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue rounded-lg text-sm disabled:opacity-40"
          >
            {loading ? t("TIMELINE_EDIT_SAVING") : t("TIMELINE_EDIT_SAVE_BTN")}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover"
          >
            {t("ADMIN_CLOSE_BTN")}
          </button>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────
export default function Timeline({ timelineRows, appid }: TimelineProps) {
  const { t } = useUiText();
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingRow, setEditingRow] = useState<TimelineRow | null>(null);
  const { toast, show, clear } = useToast();

  const EVENT_TYPE_LABELS: Record<string, string> = {
    official: t("TIMELINE_TYPE_OFFICIAL"),
    manual: t("TIMELINE_TYPE_MANUAL"),
    news: t("TIMELINE_TYPE_NEWS"),
    free_weekend: t("TIMELINE_TYPE_FREE_WEEKEND"),
    launch: t("TIMELINE_TYPE_LAUNCH"),
  };

  const allRows = useMemo(
    () => timelineRows.filter((r) => r.language_scope === "all"),
    [timelineRows]
  );

  const sorted = useMemo(
    () =>
      [...allRows].sort((a, b) =>
        sortAsc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
      ),
    [allRows, sortAsc]
  );

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
          {sortAsc ? t("TIMELINE_SORT_ASC") : t("TIMELINE_SORT_DESC")}
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
            const isLaunch = row.event_type === "launch";

            // ≤5건 리뷰 또는 "sparse" 마커: 긍정률 미표시
            const isSparse = String(row.sentiment_rate) === "sparse";
            const reviewCount = Number(row.review_count || 0);
            const isFewReviews = !isSparse && reviewCount > 0 && reviewCount <= 5;
            const rate =
              !isSparse && !isFewReviews &&
              row.sentiment_rate !== "" && row.sentiment_rate !== 0
                ? Number(row.sentiment_rate)
                : null;

            const keywords = parseKeywords(row.top_keywords);
            const reviews = parseReviews(row.top_reviews);
            const isPending = !isNews && !isSparse && !isFewReviews && rate === null && keywords.length === 0 && !row.ai_reaction_summary;

            // 클릭 가능 여부: launch/pending/fewReviews는 불가
            // sparse는 ai_patch_summary가 있으면 펼쳐서 패치 요약을 볼 수 있음
            const isExpandable = !isPending && !isLaunch && !isFewReviews && (!isSparse || !!row.ai_patch_summary);

            if (isNews) {
              return (
                <div key={row.event_id} className="flex gap-4 py-2 ml-0">
                  <div className="relative shrink-0 mt-1">
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-text-muted bg-bg-primary" />
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-text-muted">{row.date}</span>
                      <span className="text-xs bg-bg-card px-1.5 py-0.5 rounded text-text-muted border border-border-default">
                        {t("TIMELINE_TYPE_NEWS")}
                      </span>
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
                className={`flex gap-4 py-3 group/row ${isSale ? "bg-accent-orange/5" : isFreeWeekend ? "bg-accent-green/5" : ""}`}
              >
                <div className="relative shrink-0 mt-2">
                  <div className={`w-3.5 h-3.5 rounded-full border-2 ${
                    isFreeWeekend ? "border-accent-green bg-accent-green/30" :
                    isSale ? "border-accent-orange bg-accent-orange/30" :
                    isLaunch ? "border-text-muted bg-bg-secondary" :
                    isSparse || isFewReviews ? "border-border-default bg-bg-secondary" :
                    isPending ? "border-accent-yellow bg-accent-yellow/20" :
                    "border-accent-blue bg-accent-blue/30"
                  }`} />
                </div>

                <div className="flex-1 pb-3">
                  {/* 할인/무료 주말 뱃지 */}
                  {(isSale || isFreeWeekend) && (
                    <div className="mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        isFreeWeekend
                          ? "bg-accent-green/20 text-accent-green border border-accent-green/30"
                          : "bg-accent-orange/20 text-accent-orange border border-accent-orange/30"
                      }`}>
                        {isFreeWeekend ? t("TIMELINE_TYPE_FREE_WEEKEND") : row.sale_text || t("TIMELINE_SALE_TEXT")}
                      </span>
                    </div>
                  )}

                  {/* 헤더 클릭 → 접기/펼치기 */}
                  <button
                    onClick={() => isExpandable && toggleExpand(row.event_id)}
                    className={`w-full text-left ${isExpandable ? "group" : "cursor-default"}`}
                    disabled={!isExpandable}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      {row.date && <span className="text-xs text-text-muted">{row.date}</span>}
                      <span className="text-xs bg-bg-secondary border border-border-default px-1.5 py-0.5 rounded text-text-muted">
                        {EVENT_TYPE_LABELS[row.event_type] ?? row.event_type}
                      </span>

                      {/* 상태 배지 */}
                      {isPending ? (
                        <span className="text-xs text-text-muted px-2 py-0.5 bg-bg-secondary border border-border-default rounded">
                          {t("TIMELINE_PENDING")}
                        </span>
                      ) : isSparse ? (
                        <span className="text-xs text-text-muted px-2 py-0.5 bg-bg-secondary border border-border-default rounded">
                          {t("TIMELINE_SPARSE_LABEL")}
                        </span>
                      ) : isFewReviews ? (
                        <span className="text-xs text-text-muted px-2 py-0.5 bg-bg-secondary border border-border-default rounded">
                          {t("TIMELINE_FEW_REVIEWS_LABEL", { n: reviewCount })}
                        </span>
                      ) : (
                        rate !== null && <Badge rate={rate} reviewCount={reviewCount} size="sm" />
                      )}
                    </div>

                    {/* launch 이벤트는 제목 행을 별도로 표시하지 않음 */}
                    {!isLaunch && (
                      <div className="mt-1">
                        <p className={`font-medium transition-colors ${isPending || (isSparse && !isExpandable) || isFewReviews ? "text-text-secondary" : "text-text-primary group-hover:text-accent-blue"}`}>
                          {row.title_kr || row.title}
                          {isExpandable && <span className="ml-2 text-xs text-text-muted">{isExpanded ? "▲" : "▼"}</span>}
                        </p>
                        {row.title_kr && row.title_kr !== row.title && (
                          <p className="text-xs text-text-muted mt-0.5">{row.title}</p>
                        )}
                      </div>
                    )}

                    {/* 기본 표시: 키워드 */}
                    {!isPending && !isSparse && !isFewReviews && keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {keywords.map((kw, ki) => (
                          <span key={ki} className="text-xs bg-bg-secondary px-2 py-0.5 rounded text-text-secondary border border-border-default">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>

                  {/* 수정 버튼 (launch/news 제외) */}
                  {!isLaunch && !isNews && (
                    <button
                      onClick={() => setEditingRow(row)}
                      className="mt-1 text-[11px] text-text-muted opacity-0 group-hover/row:opacity-100 hover:text-accent-blue transition-all"
                    >
                      {t("TIMELINE_EDIT_BTN")}
                    </button>
                  )}

                  {/* 펼침 상세 */}
                  {isExpanded && (
                    <div className="mt-3 space-y-3 border-l-2 border-accent-blue/30 pl-4">
                      {row.ai_patch_summary && (
                        <div>
                          <p className="text-xs text-accent-blue mb-1 font-medium">{t("TIMELINE_PATCH_SUMMARY")}</p>
                          <p className="text-sm text-text-secondary leading-relaxed">{row.ai_patch_summary}</p>
                        </div>
                      )}
                      {row.ai_reaction_summary && (
                        <div>
                          <p className="text-xs text-accent-blue mb-1 font-medium">{t("TIMELINE_REACTION")}</p>
                          <p className="text-sm text-text-secondary leading-relaxed">{row.ai_reaction_summary}</p>
                        </div>
                      )}
                      {row.review_count && (
                        <p className="text-xs text-text-muted">
                          {t("TIMELINE_REVIEW_COUNT", { n: Number(row.review_count).toLocaleString() })}
                        </p>
                      )}
                      {reviews.length > 0 && (
                        <div>
                          <p className="text-xs text-accent-blue mb-2 font-medium">{t("TIMELINE_TOP_REVIEWS")}</p>
                          <div className="space-y-2">
                            {reviews.slice(0, 3).map((rv, ri) => (
                              <div key={ri} className={`bg-bg-primary border rounded-lg p-3 ${rv.voted_up ? "border-accent-green/20" : "border-accent-red/20"}`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-xs font-medium ${rv.voted_up ? "text-accent-green" : "text-accent-red"}`}>
                                    {rv.voted_up ? t("REVIEW_POSITIVE") : t("REVIEW_NEGATIVE")}
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
                          {t("TIMELINE_PATCH_NOTES_LINK")}
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

      {/* 이벤트 수정 모달 */}
      {editingRow && (
        <EditEventModal
          row={editingRow}
          appid={appid}
          onClose={() => setEditingRow(null)}
          onSaved={() => {
            setEditingRow(null);
            show(t("TIMELINE_EDIT_SAVED_NOTICE"), "success");
          }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}
