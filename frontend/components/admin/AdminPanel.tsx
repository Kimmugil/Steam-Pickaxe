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
function ToggleSwitch({ on, loading, disabled, onClick, onTitle = "", offTitle = "" }: {
  on: boolean; loading: boolean; disabled?: boolean; onClick: () => void; onTitle?: string; offTitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      title={on ? onTitle : offTitle}
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

  const COLUMN_HELP: Record<string, { title: string; lines: string[] }> = {
    status: {
      title: t("HELP_STATUS_TITLE"),
      lines: [t("HELP_STATUS_L1"), t("HELP_STATUS_L2"), t("HELP_STATUS_L3")],
    },
    ai_approved: {
      title: t("HELP_AI_TITLE"),
      lines: [t("HELP_AI_L1"), t("HELP_AI_L2"), t("HELP_AI_L3")],
    },
    reviews: {
      title: t("HELP_REVIEWS_TITLE"),
      lines: [t("HELP_REVIEWS_L1"), t("HELP_REVIEWS_L2"), t("HELP_REVIEWS_L3")],
    },
    events: {
      title: t("HELP_EVENTS_TITLE"),
      lines: [t("HELP_EVENTS_L1"), t("HELP_EVENTS_L2"), t("HELP_EVENTS_L3")],
    },
    dates: {
      title: t("HELP_DATES_TITLE"),
      lines: [t("HELP_DATES_L1"), t("HELP_DATES_L2"), t("HELP_DATES_L3")],
    },
  };

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

  // 평가 급변 감지
  const [detectingShifts, setDetectingShifts] = useState(false);

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
        if (!silent) setError(t("AUTH_WRONG_PASSWORD"));
      }
    } catch {
      if (!silent) setError(t("SERVER_CONNECT_ERROR"));
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
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
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
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
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
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
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
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
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
        show(t("ADMIN_TOAST_CORE_ANALYZE"), "success");
      } else {
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
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
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
    } finally {
      setReanalyzingIds((prev) => { const s = new Set(prev); s.delete(appid); return s; });
    }
  }

  // ── 평가 급변 감지 실행 ──────────────────────────────────────────────────
  async function handleDetectShifts() {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setDetectingShifts(true);
    try {
      const res = await fetch("/api/admin/detect-shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw }),
      });
      const data = await res.json();
      if (data.ok) {
        show("평가 급변 감지를 시작했습니다. 수 분 내 완료됩니다.", "success");
      } else {
        show(data.error ?? "오류가 발생했습니다.", "error");
      }
    } catch {
      show("서버 연결 오류", "error");
    } finally {
      setDetectingShifts(false);
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
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
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
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
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
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
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
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
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
            placeholder={t("ADMIN_BTN_PW_PLACEHOLDER")}
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
            <p>{t("ADMIN_GAMES_EMPTY")}</p>
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
                      {t("ADMIN_COL_EVENTS")}
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
                              onTitle={t("ADMIN_TOGGLE_ON_TITLE")}
                              offTitle={t("ADMIN_TOGGLE_OFF_TITLE")}
                            />
                            <span className={`text-[10px] ${isActive ? "text-accent-green" : "text-text-muted"}`}>
                              {togglingIds.has(appid) ? t("PROCESSING") : isActive ? "ON" : "OFF"}
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
                              title={t("ADMIN_APPROVE_CANCEL_TITLE")}
                              className="text-xs text-accent-green hover:text-accent-red hover:line-through transition-colors disabled:opacity-40 cursor-pointer"
                            >
                              {unapprovingIds.has(appid) ? t("PROCESSING") : t("ADMIN_BTN_APPROVED")}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleApproveGame(appid)}
                              disabled={approvingIds.has(appid)}
                              title={t("ADMIN_APPROVE_TITLE")}
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
                        <span className="text-text-muted">{t("ADMIN_REVIEWS_UNIT")}</span>
                        <br />
                        <span className="text-text-muted text-[10px]">
                          {t("ADMIN_STEAM_REVIEWS", { count: Number(game.totalReviews ?? 0).toLocaleString() })}
                        </span>
                      </td>

                      {/* 수집 이벤트 */}
                      <td className="px-4 py-3 text-xs">
                        <span className="text-text-primary font-medium">
                          {Number(game.event_count ?? 0).toLocaleString()}
                        </span>
                        <span className="text-text-muted">{t("ADMIN_EVENTS_UNIT")}</span>
                      </td>

                      {/* 마지막 수집 / AI 분석 날짜 */}
                      <td className="px-4 py-3 text-xs">
                        <div className="space-y-0.5">
                          <div>
                            <span className="text-text-muted text-[10px]">{t("ADMIN_COL_COLLECT_DATE")}</span>
                            <span className="text-text-secondary">
                              {game.last_event_date || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-text-muted text-[10px]">{t("ADMIN_COL_ANALYZE_DATE")}</span>
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
                          title={t("ADMIN_DRAG_HINT")}
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
                              title={t("ADMIN_THIS_MONTH_TITLE")}
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
                              title={t("ADMIN_CORE_ANALYZE_TITLE")}
                              className="px-2.5 py-1 text-xs bg-accent-blue/10 border border-accent-blue/30 text-accent-blue rounded hover:bg-accent-blue/20 transition-colors disabled:opacity-40"
                            >
                              {coreAnalyzingIds.has(appid) ? t("ADMIN_PROCESSING_BTN") : t("ADMIN_BTN_CORE_ANALYZE")}
                            </button>
                          )}

                          {/* AI 재분석 (뉴스 재수집 + 전범위) */}
                          {isActive && isApproved && (
                            <button
                              onClick={() => handleReanalyze(appid)}
                              disabled={reanalyzingIds.has(appid)}
                              title={t("ADMIN_REANALYZE_TITLE")}
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

          {/* 평가 급변 감지 */}
          <div className="bg-bg-card border border-border-default rounded-xl p-6 flex flex-col items-center text-center gap-4">
            <p className="text-3xl">⚡</p>
            <div>
              <p className="font-semibold text-text-primary text-sm mb-0.5">평가 급변 감지</p>
              <p className="text-xs text-text-muted leading-relaxed">
                전체 active 게임의 긍정률 급변 구간을 탐지하고 AI 원인 분석을 실행합니다.<br />
                <span className="text-text-secondary mt-1 block">매주 월요일 자동 실행. 즉시 실행이 필요할 때 사용하세요.</span>
              </p>
            </div>
            <button
              onClick={handleDetectShifts}
              disabled={detectingShifts}
              className="w-full py-2 text-sm border border-accent-yellow/40 rounded-lg text-accent-yellow hover:bg-accent-yellow/10 transition-colors disabled:opacity-40"
            >
              {detectingShifts ? "처리 중..." : "⚡ 급변 감지 실행"}
            </button>
          </div>

        </div>
      </section>

      {/* GitHub Actions 워크플로우 현황 */}
      <section className="mt-8">
        <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-accent-green rounded-full" />
          GitHub Actions 워크플로우 현황
        </h2>
        <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-border-default bg-bg-secondary">
                <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">워크플로우</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">자동 주기</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">설명</th>
              </tr>
            </thead>
            <tbody>
              {([
                {
                  name: "CCU 수집",
                  schedule: "매 시간 정각",
                  desc: "active 게임의 동접자를 Steam API로 수집해 개별 시트에 적재합니다.",
                },
                {
                  name: "리뷰·뉴스 수집",
                  schedule: "매일 05:00 KST",
                  desc: "신규 리뷰·이벤트를 수집합니다. 신규 게임 등록 시 자동 트리거됩니다. 관리자 패널 '수집 재시작'으로 즉시 실행 가능.",
                },
                {
                  name: "AI 월간 분석",
                  schedule: "매월 1일 09:00 KST",
                  desc: "AI 승인된 게임의 월별 리뷰 감성 분석·패치 요약·AI 브리핑·CCU 피크타임·언어권 교차 분석을 실행합니다. 관리자 패널 게임별 버튼으로 온디맨드 실행 가능.",
                },
                {
                  name: "평가 급변 감지",
                  schedule: "매주 월요일 11:00 KST",
                  desc: "전체 기간 긍정률 변화를 분석해 급락·회복 구간을 탐지하고 AI 원인 분석을 수행합니다. 관리자 패널 '급변 감지 실행'으로 즉시 실행 가능.",
                },
                {
                  name: "이번 달 수집+분석",
                  schedule: "수동 전용",
                  desc: "특정 게임의 이번 달 뉴스·이벤트를 재수집하고 AI 분석을 즉시 실행합니다. 게임별 '이번 달' 버튼으로 트리거.",
                },
                {
                  name: "종합 분석",
                  schedule: "수동 전용",
                  desc: "이벤트 수집 없이 AI 브리핑·CCU 피크타임·평가 추이·언어권 교차 분석 4가지만 즉시 갱신합니다. 게임별 '종합 분석' 버튼으로 트리거.",
                },
                {
                  name: "AI 재분석",
                  schedule: "수동 전용",
                  desc: "최신 뉴스·패치를 재수집하고 전체 기간 AI 분석을 다시 실행합니다. 게임별 '재분석' 버튼으로 트리거.",
                },
                {
                  name: "UI 텍스트 초기 설정",
                  schedule: "수동 전용 (1회성)",
                  desc: "Google Sheets ui_text 탭에 기본 UI 문구를 초기화합니다. 관리자 패널 'UI 텍스트 동기화'로 이후 업데이트 관리.",
                },
              ] as const).map((row, i) => (
                <tr
                  key={row.name}
                  className={`border-b border-border-default last:border-b-0 ${i % 2 === 0 ? "" : "bg-bg-secondary/20"}`}
                >
                  <td className="px-4 py-3 text-xs font-medium text-text-primary whitespace-nowrap">{row.name}</td>
                  <td className="px-4 py-3 text-xs text-accent-blue whitespace-nowrap">{row.schedule}</td>
                  <td className="px-4 py-3 text-xs text-text-muted leading-relaxed">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
