"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Toast, { useToast } from "@/components/shared/Toast";
import type { Game, GameStatus } from "@/types";
import { useUiText } from "@/contexts/UiTextContext";

const SESSION_KEY = "steam_admin_pw";

const STATUS_COLORS: Record<GameStatus, string> = {
  active: "bg-accent-green/20 text-accent-green border-accent-green/30",
  collecting: "bg-accent-blue/20 text-accent-blue border-accent-blue/30",
  archived: "bg-bg-secondary text-text-muted border-border-default",
  error_pool_empty: "bg-accent-red/20 text-accent-red border-accent-red/30",
};

// ── 컬럼 도움말 정의 ──────────────────────────────────────────────────────────
const COLUMN_HELP: Record<string, { title: string; lines: string[] }> = {
  status: {
    title: "수집 활성 ON / OFF",
    lines: [
      "ON (활성): 봇이 이 게임의 리뷰와 이벤트를 주기적으로 수집하며, 홈 화면에 노출됩니다.",
      "OFF (숨김): 수집이 중단되고 홈 화면에서 숨겨집니다. 기존 수집 데이터는 모두 보존되며, 언제든 다시 ON으로 복원할 수 있습니다.",
      "수집 중(파란색) 또는 수집 오류(빨간색) 상태에서는 ON/OFF 전환이 비활성화됩니다.",
    ],
  },
  ai_approved: {
    title: "AI 승인",
    lines: [
      "✅ 승인됨: 매월 1일 자동 AI 분석 대상에 포함됩니다. 관리자 패널의 '이번 달' 버튼 또는 '재분석' 버튼으로 온디맨드 실행도 가능합니다.",
      "⏳ 미승인: AI 분석이 실행되지 않습니다. 게임을 처음 등록하면 자동으로 미승인 상태가 됩니다.",
      "AI 분석 범위: 게임 브리핑, 이벤트별 패치 요약 및 플레이어 반응 분석, 언어권 교차 분석, CCU 피크타임 분석, 감성 추이 진단.",
    ],
  },
  reviews: {
    title: "수집 리뷰 / Steam 총 리뷰",
    lines: [
      "좌측 (수집): Google Sheets RAW 시트에 실제 저장된 리뷰 수입니다. collect.yml 워크플로우가 매일 누적합니다.",
      "우측 (Steam): Steam 스토어 기준 총 리뷰 수입니다. 수집 목표치로, 두 값이 같으면 모든 리뷰 수집이 완료된 상태입니다.",
      "수집 도중 커서가 리셋되면 좌측 값이 일시적으로 낮게 표시될 수 있습니다.",
    ],
  },
  events: {
    title: "수집 이벤트",
    lines: [
      "Google Sheets 타임라인 시트에 수집된 이벤트(공식 패치노트 + 외부 뉴스·미디어) 총 수입니다.",
      "공식 이벤트: Steam 공식 발표 및 패치노트. 외부 이벤트: 관련 뉴스·미디어 기사.",
      "현재 Steam 전체 공개 이벤트 수는 별도로 추적하지 않습니다.",
    ],
  },
  dates: {
    title: "마지막 수집 / AI 분석",
    lines: [
      "마지막 수집: 이벤트가 마지막으로 수집·업데이트된 날짜입니다 (last_event_date 기준).",
      "AI 분석: 게임 브리핑과 이벤트 AI 분석이 마지막으로 실행된 날짜입니다 (ai_briefing_date 기준).",
      "두 날짜 차이가 클수록 수집 이후 AI 분석이 아직 반영되지 않은 구간이 있을 수 있습니다.",
    ],
  },
};

// ── 도움말 버튼 ───────────────────────────────────────────────────────────────
function HelpBtn({ col, onClick }: { col: string; onClick: (c: string) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(col); }}
      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-text-muted/20 text-text-muted hover:bg-accent-blue/20 hover:text-accent-blue text-[9px] font-bold transition-colors ml-1 flex-shrink-0"
      title="도움말"
    >
      ?
    </button>
  );
}

// ── ON/OFF 토글 스위치 ────────────────────────────────────────────────────────
function ToggleSwitch({ on, loading, disabled, onClick }: {
  on: boolean; loading: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      title={on ? "ON — 클릭하면 수집 중단(숨김)" : "OFF — 클릭하면 수집 재개(활성)"}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-40 focus:outline-none ${
        on ? "bg-accent-green" : "bg-border-default"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-[18px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

export default function AdminPanel({ allGames }: { allGames: Game[] }) {
  const router = useRouter();
  const { t } = useUiText();
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast, show, clear } = useToast();

  const STATUS_LABELS: Record<GameStatus, string> = {
    active: t("ADMIN_STATUS_ACTIVE"),
    collecting: t("ADMIN_STATUS_COLLECTING"),
    archived: t("ADMIN_STATUS_ARCHIVED"),
    error_pool_empty: t("ADMIN_STATUS_ERROR"),
  };

  // 도움말 팝업
  const [activeHelp, setActiveHelp] = useState<string | null>(null);

  // 시스템 도구 상태
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [analyzingPending, setAnalyzingPending] = useState(false);
  const [showRetriggerConfirm, setShowRetriggerConfirm] = useState(false);
  const [retriggering, setRetriggering] = useState(false);

  // 드래그 순서 상태
  const [orderedGames, setOrderedGames] = useState<Game[]>(() =>
    [...allGames].sort((a, b) => (Number(a.sort_order) || 9999) - (Number(b.sort_order) || 9999))
  );
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // 게임별 액션 로딩 상태
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [unapprovingIds, setUnapprovingIds] = useState<Set<string>>(new Set());
  const [collectingMonthIds, setCollectingMonthIds] = useState<Set<string>>(new Set());
  const [reanalyzingIds, setReanalyzingIds] = useState<Set<string>>(new Set());
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [coreAnalyzingIds, setCoreAnalyzingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) attemptAuth(saved, true);
  }, []);

  async function attemptAuth(password: string, silent = false) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        sessionStorage.setItem(SESSION_KEY, password);
        setAuthed(true);
      } else {
        sessionStorage.removeItem(SESSION_KEY);
        if (!silent) setError("비밀번호가 올바르지 않습니다.");
      }
    } catch {
      if (!silent) setError("서버 연결 오류");
    } finally {
      setLoading(false);
    }
  }

  function getSavedPw(): string | null {
    return sessionStorage.getItem(SESSION_KEY);
  }

  // ── 수집 활성 ON/OFF 토글 ─────────────────────────────────────────────────
  async function handleToggleActive(appid: string, isCurrentlyActive: boolean) {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setTogglingIds((prev) => new Set(prev).add(appid));
    const endpoint = isCurrentlyActive ? "/api/admin/delete" : "/api/admin/restore";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw, appid }),
      });
      const data = await res.json();
      if (data.ok) {
        show(isCurrentlyActive ? t("ADMIN_TOAST_HIDE") : t("ADMIN_TOAST_RESTORE"), "success");
        router.refresh();
      } else {
        show(data.error ?? "오류가 발생했습니다.", "error");
      }
    } catch {
      show("서버 연결 오류", "error");
    } finally {
      setTogglingIds((prev) => { const s = new Set(prev); s.delete(appid); return s; });
    }
  }

  // ── AI 분석 승인 ──────────────────────────────────────────────────────────
  async function handleApproveGame(appid: string) {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setApprovingIds((prev) => new Set(prev).add(appid));
    try {
      const res = await fetch("/api/admin/approve-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw, appid }),
      });
      const data = await res.json();
      if (data.ok) {
        show(t("ADMIN_TOAST_APPROVE"), "success");
        router.refresh();
      } else {
        show(data.error ?? "오류가 발생했습니다.", "error");
      }
    } catch {
      show("서버 연결 오류", "error");
    } finally {
      setApprovingIds((prev) => { const s = new Set(prev); s.delete(appid); return s; });
    }
  }

  // ── AI 분석 승인 취소 ─────────────────────────────────────────────────────
  async function handleUnapproveGame(appid: string) {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setUnapprovingIds((prev) => new Set(prev).add(appid));
    try {
      const res = await fetch("/api/admin/unapprove-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw, appid }),
      });
      const data = await res.json();
      if (data.ok) {
        show(t("ADMIN_TOAST_UNAPPROVE"), "success");
        router.refresh();
      } else {
        show(data.error ?? "오류가 발생했습니다.", "error");
      }
    } catch {
      show("서버 연결 오류", "error");
    } finally {
      setUnapprovingIds((prev) => { const s = new Set(prev); s.delete(appid); return s; });
    }
  }

  // ── 현재 월 수집+분석 ─────────────────────────────────────────────────────
  async function handleCollectMonth(appid: string) {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setCollectingMonthIds((prev) => new Set(prev).add(appid));
    try {
      const res = await fetch("/api/admin/collect-month", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw, appid }),
      });
      const data = await res.json();
      if (data.ok) {
        show(t("ADMIN_TOAST_MONTH"), "success");
      } else {
        show(data.error ?? "오류가 발생했습니다.", "error");
      }
    } catch {
      show("서버 연결 오류", "error");
    } finally {
      setCollectingMonthIds((prev) => { const s = new Set(prev); s.delete(appid); return s; });
    }
  }

  // ── 종합 분석 (4개 핵심 분석만) ──────────────────────────────────────────
  async function handleCoreAnalyze(appid: string) {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setCoreAnalyzingIds((prev) => new Set(prev).add(appid));
    try {
      const res = await fetch("/api/admin/analyze-core", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw, appid }),
      });
      const data = await res.json();
      if (data.ok) {
        show("종합 분석을 요청했습니다. 수분 내 반영됩니다. (이벤트 수집 없이 브리핑·CCU·언어·추이만 갱신)", "success");
      } else {
        show(data.error ?? "오류가 발생했습니다.", "error");
      }
    } catch {
      show("서버 연결 오류", "error");
    } finally {
      setCoreAnalyzingIds((prev) => { const s = new Set(prev); s.delete(appid); return s; });
    }
  }

  // ── AI 재분석 ─────────────────────────────────────────────────────────────
  async function handleReanalyze(appid: string) {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setReanalyzingIds((prev) => new Set(prev).add(appid));
    try {
      const res = await fetch("/api/admin/reanalyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw, appid }),
      });
      const data = await res.json();
      if (data.ok) {
        show(t("ADMIN_TOAST_REANALYZE"), "success");
      } else {
        show(data.error ?? "오류가 발생했습니다.", "error");
      }
    } catch {
      show("서버 연결 오류", "error");
    } finally {
      setReanalyzingIds((prev) => { const s = new Set(prev); s.delete(appid); return s; });
    }
  }

  // ── 드래그 순서 변경 ─────────────────────────────────────────────────────
  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx !== null && dragOverIdx !== idx) setDragOverIdx(idx);
  }

  function handleDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const next = [...orderedGames];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(targetIdx, 0, moved);
    setOrderedGames(next);
    setDragIdx(null);
    setDragOverIdx(null);
    saveSortOrders(next);
  }

  function handleDragEnd() {
    setDragIdx(null);
    setDragOverIdx(null);
  }

  async function saveSortOrders(games: Game[]) {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    const orders = games.map((g, i) => ({ appid: String(g.appid), sort_order: i + 1 }));
    try {
      const res = await fetch("/api/admin/sort-order-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw, orders }),
      });
      const data = await res.json();
      if (data.ok) {
        show(t("ADMIN_TOAST_SORT_ORDER"), "success");
      } else {
        show(data.error ?? "오류가 발생했습니다.", "error");
      }
    } catch {
      show("서버 연결 오류", "error");
    }
  }

  // ── UI 텍스트 동기화 ──────────────────────────────────────────────────────
  async function handleSyncUiText(reset: boolean, force = false) {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/sync-ui-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw, reset, force }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowSyncModal(false);
        if (force) {
          show(t("ADMIN_TOAST_FORCE", { added: data.added }), "success");
        } else if (reset) {
          show(t("ADMIN_TOAST_RESET", { kept: data.kept, added: data.added, removed: data.removed }), "success");
        } else {
          show(t("ADMIN_TOAST_SYNC", { added: data.added, skipped: data.skipped }), "success");
        }
      } else {
        show(data.error ?? "오류가 발생했습니다.", "error");
      }
    } catch {
      show("서버 연결 오류", "error");
    } finally {
      setSyncing(false);
    }
  }

  // ── 미분석 AI 분석 ────────────────────────────────────────────────────────
  async function handleAnalyzePending() {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setAnalyzingPending(true);
    try {
      const res = await fetch("/api/admin/analyze-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw }),
      });
      const data = await res.json();
      if (data.ok) {
        show(t("ADMIN_TOAST_ANALYZE_PENDING"), "success");
      } else {
        show(data.error ?? "오류가 발생했습니다.", "error");
      }
    } catch {
      show("서버 연결 오류", "error");
    } finally {
      setAnalyzingPending(false);
    }
  }

  // ── 수집 재시작 ───────────────────────────────────────────────────────────
  async function handleRetriggerCollect() {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setRetriggering(true);
    setShowRetriggerConfirm(false);
    try {
      const res = await fetch("/api/admin/retrigger-collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw }),
      });
      const data = await res.json();
      if (data.ok) {
        show(t("ADMIN_TOAST_RETRIGGER"), "success");
      } else {
        show(data.error ?? "오류가 발생했습니다.", "error");
      }
    } catch {
      show("서버 연결 오류", "error");
    } finally {
      setRetriggering(false);
    }
  }

  // ── 비밀번호 게이트 ──────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-20">
        <div className="bg-bg-card border border-border-default rounded-xl p-8 text-center">
          <p className="text-2xl mb-2">🔒</p>
          <h1 className="text-lg font-semibold text-text-primary mb-1">{t("ADMIN_LOGIN_TITLE")}</h1>
          <p className="text-xs text-text-muted mb-6">{t("ADMIN_LOGIN_DESC")}</p>
          {error && <p className="text-xs text-accent-red mb-3">{error}</p>}
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && pw && attemptAuth(pw)}
            placeholder="비밀번호"
            className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue mb-3"
            autoFocus
          />
          <button
            onClick={() => attemptAuth(pw)}
            disabled={loading || !pw}
            className="w-full py-2 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue rounded-lg text-sm disabled:opacity-40"
          >
            {loading ? t("ADMIN_LOGIN_LOADING") : t("ADMIN_LOGIN_BTN")}
          </button>
        </div>
      </div>
    );
  }

  // ── 관리자 콘텐츠 ────────────────────────────────────────────────────────
  const pendingAiGames = allGames.filter(
    (g) =>
      g.status === "active" &&
      !String(g.ai_briefing ?? "").trim() &&
      String(g.ai_approved ?? "").toLowerCase() !== "true"
  );

  // 현재 도움말 내용
  const helpData = activeHelp ? COLUMN_HELP[activeHelp] : null;

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-10">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          {t("ADMIN_PAGE_TITLE")}
        </h1>
        <p className="text-sm text-text-muted mt-1">
          {t("ADMIN_PAGE_SUBTITLE")}
        </p>
      </div>

      {/* 전체 게임 현황 */}
      <section className="mb-10">
        <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-accent-blue rounded-full" />
          {t("ADMIN_SECTION_GAMES")}
          <span className="text-xs font-normal text-text-muted">({orderedGames.length}개)</span>
        </h2>

        {orderedGames.length === 0 ? (
          <div className="text-center py-16 text-text-muted border border-dashed border-border-default rounded-xl">
            <p className="text-3xl mb-3">🎮</p>
            <p>등록된 게임이 없습니다.</p>
          </div>
        ) : (
          <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-border-default bg-bg-secondary">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">{t("ADMIN_COL_GAME")}</th>

                  {/* 수집 활성 */}
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">
                    <span className="inline-flex items-center gap-0.5">
                      {t("ADMIN_COL_STATUS")}
                      <HelpBtn col="status" onClick={setActiveHelp} />
                    </span>
                  </th>

                  {/* AI 승인 */}
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">
                    <span className="inline-flex items-center gap-0.5">
                      {t("ADMIN_COL_AI_APPROVED")}
                      <HelpBtn col="ai_approved" onClick={setActiveHelp} />
                    </span>
                  </th>

                  {/* 수집 리뷰 */}
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">
                    <span className="inline-flex items-center gap-0.5">
                      {t("ADMIN_COL_REVIEWS")}
                      <HelpBtn col="reviews" onClick={setActiveHelp} />
                    </span>
                  </th>

                  {/* 수집 이벤트 */}
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">
                    <span className="inline-flex items-center gap-0.5">
                      수집 이벤트
                      <HelpBtn col="events" onClick={setActiveHelp} />
                    </span>
                  </th>

                  {/* 마지막 수집 / AI 분석 */}
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">
                    <span className="inline-flex items-center gap-0.5">
                      {t("ADMIN_COL_LAST_ANALYSIS")}
                      <HelpBtn col="dates" onClick={setActiveHelp} />
                    </span>
                  </th>

                  {/* 순서 */}
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap w-10">{t("ADMIN_COL_ORDER")}</th>

                  {/* 액션 */}
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">{t("ADMIN_COL_ACTION")}</th>
                </tr>
              </thead>
              <tbody>
                {orderedGames.map((game, i) => {
                  const appid = String(game.appid);
                  const isActive = game.status === "active";
                  const isArchived = game.status === "archived";
                  const canToggle = isActive || isArchived;
                  const isApproved = String(game.ai_approved ?? "").toLowerCase() === "true";
                  const needsApproval = isActive && !String(game.ai_briefing ?? "").trim() && !isApproved;
                  const isDragging = dragIdx === i;
                  const isDragOver = dragOverIdx === i && dragIdx !== null && dragIdx !== i;

                  return (
                    <tr
                      key={appid}
                      draggable
                      onDragStart={() => handleDragStart(i)}
                      onDragOver={(e) => handleDragOver(e, i)}
                      onDrop={() => handleDrop(i)}
                      onDragEnd={handleDragEnd}
                      className={`border-b border-border-default last:border-b-0 transition-colors ${
                        isArchived ? "opacity-60" : "hover:bg-bg-secondary/50"
                      } ${isDragging ? "opacity-40" : ""} ${isDragOver ? "border-t-2 border-accent-blue bg-accent-blue/5" : ""}`}
                    >
                      {/* 게임명 */}
                      <td className="px-4 py-3">
                        <a
                          href={`/game/${appid}`}
                          className="font-medium text-text-primary hover:text-accent-blue transition-colors"
                        >
                          {game.name_kr || game.name}
                        </a>
                        {game.name_kr && game.name_kr !== game.name && (
                          <p className="text-xs text-text-muted truncate max-w-[180px]">{game.name}</p>
                        )}
                        <p className="text-xs text-text-muted">AppID {appid}</p>
                      </td>

                      {/* 수집 활성 ON/OFF */}
                      <td className="px-4 py-3">
                        {canToggle ? (
                          <div className="flex flex-col gap-1">
                            <ToggleSwitch
                              on={isActive}
                              loading={togglingIds.has(appid)}
                              onClick={() => handleToggleActive(appid, isActive)}
                            />
                            <span className={`text-[10px] ${isActive ? "text-accent-green" : "text-text-muted"}`}>
                              {togglingIds.has(appid) ? "처리 중..." : isActive ? "ON" : "OFF"}
                            </span>
                          </div>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                              STATUS_COLORS[game.status]
                            }`}
                          >
                            {STATUS_LABELS[game.status]}
                          </span>
                        )}
                      </td>

                      {/* AI 승인 토글 */}
                      <td className="px-4 py-3">
                        {isActive ? (
                          isApproved ? (
                            <button
                              onClick={() => handleUnapproveGame(appid)}
                              disabled={unapprovingIds.has(appid)}
                              title="클릭하면 AI 분석 승인이 취소됩니다."
                              className="text-xs text-accent-green hover:text-accent-red hover:line-through transition-colors disabled:opacity-40 cursor-pointer"
                            >
                              {unapprovingIds.has(appid) ? t("PROCESSING") : t("ADMIN_BTN_APPROVED")}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleApproveGame(appid)}
                              disabled={approvingIds.has(appid)}
                              title="클릭하면 AI 분석을 승인하고 즉시 분석 워크플로우가 트리거됩니다."
                              className="text-xs text-accent-orange hover:text-accent-green transition-colors disabled:opacity-40 cursor-pointer"
                            >
                              {approvingIds.has(appid) ? t("PROCESSING") : t("ADMIN_BTN_UNAPPROVED")}
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </td>

                      {/* 수집 리뷰 / Steam 총 리뷰 */}
                      <td className="px-4 py-3 text-xs">
                        <span className="text-text-primary font-medium">
                          {Number(game.collected_reviews_count ?? 0).toLocaleString()}
                        </span>
                        <span className="text-text-muted"> 리뷰</span>
                        <br />
                        <span className="text-text-muted text-[10px]">
                          Steam: {Number(game.totalReviews ?? 0).toLocaleString()}건
                        </span>
                      </td>

                      {/* 수집 이벤트 */}
                      <td className="px-4 py-3 text-xs">
                        <span className="text-text-primary font-medium">
                          {Number(game.event_count ?? 0).toLocaleString()}
                        </span>
                        <span className="text-text-muted"> 건</span>
                      </td>

                      {/* 마지막 수집 / AI 분석 날짜 */}
                      <td className="px-4 py-3 text-xs">
                        <div className="space-y-0.5">
                          <div>
                            <span className="text-text-muted text-[10px]">수집 </span>
                            <span className="text-text-secondary">
                              {game.last_event_date || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-text-muted text-[10px]">분석 </span>
                            <span className="text-text-secondary">
                              {game.ai_briefing_date || "—"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 드래그 핸들 */}
                      <td className="px-2 py-3 text-center">
                        <span
                          className="inline-flex flex-col gap-[3px] cursor-grab active:cursor-grabbing px-1 py-1 rounded hover:bg-bg-hover"
                          title="드래그해서 순서 변경"
                        >
                          <span className="block w-4 h-[2px] bg-text-muted/50 rounded" />
                          <span className="block w-4 h-[2px] bg-text-muted/50 rounded" />
                          <span className="block w-4 h-[2px] bg-text-muted/50 rounded" />
                        </span>
                      </td>

                      {/* 액션 버튼 */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {/* AI 분석 승인 (미승인 게임만) */}
                          {needsApproval && (
                            <button
                              onClick={() => handleApproveGame(appid)}
                              disabled={approvingIds.has(appid)}
                              className="px-2.5 py-1 text-xs bg-accent-orange/10 border border-accent-orange/40 text-accent-orange rounded hover:bg-accent-orange/20 transition-colors disabled:opacity-40"
                            >
                              {approvingIds.has(appid) ? t("PROCESSING") : t("ADMIN_BTN_APPROVE_AI")}
                            </button>
                          )}

                          {/* 이번 달 수집+분석 */}
                          {isActive && (
                            <button
                              onClick={() => handleCollectMonth(appid)}
                              disabled={collectingMonthIds.has(appid)}
                              title="이번 달 뉴스·이벤트를 재수집하고 AI 분석을 즉시 실행합니다."
                              className="px-2.5 py-1 text-xs bg-accent-blue/10 border border-accent-blue/30 text-accent-blue rounded hover:bg-accent-blue/20 transition-colors disabled:opacity-40"
                            >
                              {collectingMonthIds.has(appid) ? t("PROCESSING") : t("ADMIN_BTN_THIS_MONTH")}
                            </button>
                          )}

                          {/* 종합 분석 (이벤트 수집 없이 4개 핵심 분석만) */}
                          {isActive && isApproved && (
                            <button
                              onClick={() => handleCoreAnalyze(appid)}
                              disabled={coreAnalyzingIds.has(appid)}
                              title="이벤트 수집 없이 AI 브리핑·CCU 피크타임·평가 추이·언어권 교차 분석만 즉시 갱신합니다."
                              className="px-2.5 py-1 text-xs bg-accent-blue/10 border border-accent-blue/30 text-accent-blue rounded hover:bg-accent-blue/20 transition-colors disabled:opacity-40"
                            >
                              {coreAnalyzingIds.has(appid) ? "요청 중..." : "🔬 종합 분석"}
                            </button>
                          )}

                          {/* AI 재분석 (뉴스 재수집 + 전범위) */}
                          {isActive && isApproved && (
                            <button
                              onClick={() => handleReanalyze(appid)}
                              disabled={reanalyzingIds.has(appid)}
                              title="최신 뉴스·패치를 재수집하고 전체 기간 AI 분석을 다시 실행합니다."
                              className="px-2.5 py-1 text-xs bg-bg-secondary border border-border-default text-text-secondary rounded hover:border-accent-blue/40 hover:text-accent-blue transition-colors disabled:opacity-40"
                            >
                              {reanalyzingIds.has(appid) ? t("PROCESSING") : t("ADMIN_BTN_REANALYZE")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* AI 분석 미승인 요약 */}
        {pendingAiGames.length > 0 && (
          <p className="mt-3 text-xs text-accent-orange">
            {t("ADMIN_PENDING_WARNING", { n: pendingAiGames.length })}
          </p>
        )}
      </section>

      {/* 시스템 도구 */}
      <section>
        <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-accent-orange rounded-full" />
          {t("ADMIN_SECTION_TOOLS")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* UI 텍스트 동기화 */}
          <div className="bg-bg-card border border-border-default rounded-xl p-6 flex flex-col items-center text-center gap-4">
            <p className="text-3xl">📝</p>
            <div>
              <p className="font-semibold text-text-primary text-sm mb-0.5">{t("ADMIN_TOOL_SYNC_TITLE")}</p>
              <p className="text-xs text-text-muted leading-relaxed">
                {t("ADMIN_TOOL_SYNC_DESC")}<br />
                <span className="text-text-secondary mt-1 block">{t("ADMIN_TOOL_SYNC_NOTE")}</span>
              </p>
            </div>
            <button
              onClick={() => setShowSyncModal(true)}
              disabled={syncing}
              className="w-full py-2 text-sm border border-border-default rounded-lg text-text-secondary hover:border-accent-blue/50 hover:text-accent-blue transition-colors disabled:opacity-40"
            >
              {syncing ? t("PROCESSING") : t("ADMIN_TOOL_SYNC_BTN")}
            </button>
          </div>

          {/* 미분석 AI 분석 */}
          <div className="bg-bg-card border border-border-default rounded-xl p-6 flex flex-col items-center text-center gap-4">
            <p className="text-3xl">⚡</p>
            <div>
              <p className="font-semibold text-text-primary text-sm mb-0.5">{t("ADMIN_TOOL_ANALYZE_TITLE")}</p>
              <p className="text-xs text-text-muted leading-relaxed">
                {t("ADMIN_TOOL_ANALYZE_DESC")}<br />
                <span className="text-text-secondary mt-1 block">{t("ADMIN_TOOL_ANALYZE_NOTE")}</span>
              </p>
            </div>
            <button
              onClick={handleAnalyzePending}
              disabled={analyzingPending}
              className="w-full py-2 text-sm border border-accent-blue/40 rounded-lg text-accent-blue hover:bg-accent-blue/10 transition-colors disabled:opacity-40"
            >
              {analyzingPending ? t("PROCESSING") : t("ADMIN_TOOL_ANALYZE_BTN")}
            </button>
            </button>
          </div>

          {/* 수집 재시작 */}
          <div className="bg-bg-card border border-border-default rounded-xl p-6 flex flex-col items-center text-center gap-4">
            <p className="text-3xl">🔄</p>
            <div>
              <p className="font-semibold text-text-primary text-sm mb-0.5">{t("ADMIN_TOOL_COLLECT_TITLE")}</p>
              <p className="text-xs text-text-muted leading-relaxed">
                {t("ADMIN_TOOL_COLLECT_DESC")}<br />
              </p>
            </div>
            <button
              onClick={() => setShowRetriggerConfirm(true)}
              disabled={retriggering}
              className="w-full py-2 text-sm border border-border-default rounded-lg text-text-secondary hover:border-accent-orange/50 hover:text-accent-orange transition-colors disabled:opacity-40"
            >
              {retriggering ? t("PROCESSING") : t("ADMIN_TOOL_COLLECT_BTN")}
            </button>
          </div>

        </div>
      </section>

      {/* ── 도움말 모달 ──────────────────────────────────────────────────────── */}
      {activeHelp && helpData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setActiveHelp(null)}
        >
          <div
            className="bg-bg-card border border-border-default rounded-xl p-6 max-w-md w-[calc(100vw-2rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-semibold text-text-primary mb-3">{helpData.title}</p>
            <ul className="space-y-2">
              {helpData.lines.map((line, idx) => (
                <li key={idx} className="flex gap-2 text-xs text-text-secondary leading-relaxed">
                  <span className="text-accent-blue mt-0.5 flex-shrink-0">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setActiveHelp(null)}
              className="mt-5 w-full py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover transition-colors"
            >
              {t("ADMIN_CLOSE_BTN")}
            </button>
          </div>
        </div>
      )}

      {/* UI 텍스트 동기화 모달 */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-card border border-border-default rounded-xl p-6 w-84 max-w-[calc(100vw-2rem)]">
            <p className="font-semibold mb-1">{t("ADMIN_SYNC_MODAL_TITLE")}</p>
            <p className="text-xs text-text-muted mb-4 leading-relaxed">
              <span className="font-medium text-text-secondary">{t("ADMIN_SYNC_MODAL_SYNC")}</span><br />
              <span className="font-medium text-accent-orange">{t("ADMIN_SYNC_MODAL_RESET")}</span><br />
              <span className="font-medium text-accent-red">{t("ADMIN_SYNC_MODAL_FORCE")}</span>
            </p>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => handleSyncUiText(false)}
                disabled={syncing}
                className="flex-1 py-2 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue rounded-lg text-sm disabled:opacity-40"
              >
                {syncing ? t("PROCESSING") : t("ADMIN_SYNC_BTN_SYNC")}
              </button>
              <button
                onClick={() => handleSyncUiText(true)}
                disabled={syncing}
                className="flex-1 py-2 bg-accent-orange/20 border border-accent-orange/40 text-accent-orange rounded-lg text-sm disabled:opacity-40"
              >
                {syncing ? t("PROCESSING") : t("ADMIN_SYNC_BTN_RESET")}
              </button>
            </div>
            <button
              onClick={() => handleSyncUiText(true, true)}
              disabled={syncing}
              className="w-full mb-2 py-2 bg-accent-red/10 border border-accent-red/40 text-accent-red rounded-lg text-sm disabled:opacity-40 hover:bg-accent-red/20 transition-colors"
            >
              {syncing ? t("PROCESSING") : t("ADMIN_SYNC_BTN_FORCE")}
            </button>
            <button
              onClick={() => setShowSyncModal(false)}
              className="w-full py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover"
            >
              {t("ADMIN_BTN_CANCEL")}
            </button>
          </div>
        </div>
      )}

      {/* 수집 재시작 확인 모달 */}
      {showRetriggerConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-card border border-border-default rounded-xl p-6 w-80">
            <p className="font-semibold mb-1">{t("ADMIN_RETRIGGER_MODAL_TITLE")}</p>
            <p className="text-xs text-text-muted mb-5 leading-relaxed">
              {t("ADMIN_RETRIGGER_MODAL_DESC")}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRetriggerCollect}
                disabled={retriggering}
                className="flex-1 py-2 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue rounded-lg text-sm disabled:opacity-40"
              >
                {t("ADMIN_RETRIGGER_BTN")}
              </button>
              <button
                onClick={() => setShowRetriggerConfirm(false)}
                className="flex-1 py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover"
              >
                {t("ADMIN_BTN_CANCEL")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}
