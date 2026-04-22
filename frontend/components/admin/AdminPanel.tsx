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
function ToggleSwitch({ on, loading, onClick, onTitle = "", offTitle = "" }: {
  on: boolean; loading: boolean; onClick: () => void; onTitle?: string; offTitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
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
      title: "리뷰 수집 현황",
      lines: [
        "수집: 현재까지 RAW 시트에 적재된 이 게임의 리뷰 총 건수입니다.",
        "Steam 총계: Steam 스토어 기준 이 게임의 전체 리뷰 수입니다.",
        "↑ 자동 재분석 예정: 직전 분석 이후 리뷰가 10% 이상 증가했을 때 표시됩니다. 다음 월간 분석 시 완료된 월도 자동 재분석됩니다.",
      ],
    },
    dates: {
      title: t("HELP_DATES_TITLE"),
      lines: [t("HELP_DATES_L1"), t("HELP_DATES_L2"), t("HELP_DATES_L3")],
    },
  };

  // ── 인증 ──────────────────────────────────────────────────────────────────
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

  // ── UI 상태 ───────────────────────────────────────────────────────────────
  const [activeHelp, setActiveHelp] = useState<string | null>(null);

  // 드래그 순서
  const [orderedGames, setOrderedGames] = useState<Game[]>(() =>
    [...allGames].sort((a, b) => (Number(a.sort_order) || 9999) - (Number(b.sort_order) || 9999))
  );
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // AI 승인
  const [approveConfirmGame, setApproveConfirmGame] = useState<Game | null>(null);
  const [approveOnlyIds, setApproveOnlyIds] = useState<Set<string>>(new Set());

  // 구간 재분석 입력 모달
  const [monthInputGame, setMonthInputGame] = useState<string | null>(null);
  const [monthInputVal, setMonthInputVal] = useState("");

  // ── 게임별 액션 로딩 상태 ─────────────────────────────────────────────────
  const [togglingIds,          setTogglingIds]          = useState<Set<string>>(new Set());
  const [approvingIds,         setApprovingIds]         = useState<Set<string>>(new Set());
  const [unapprovingIds,       setUnapprovingIds]       = useState<Set<string>>(new Set());
  const [coreAnalyzingIds,     setCoreAnalyzingIds]     = useState<Set<string>>(new Set());
  const [timelineAnalyzingIds, setTimelineAnalyzingIds] = useState<Set<string>>(new Set());
  const [monthAnalyzingIds,    setMonthAnalyzingIds]    = useState<Set<string>>(new Set());
  const [collectNewsIds,       setCollectNewsIds]       = useState<Set<string>>(new Set());

  // ── 시스템 도구 로딩 상태 ────────────────────────────────────────────────
  const [analyzingPending,   setAnalyzingPending]   = useState(false);
  const [detectingShifts,    setDetectingShifts]    = useState(false);
  const [retriggering,       setRetriggering]       = useState(false);
  const [recalcingLangDist,  setRecalcingLangDist]  = useState(false);
  const [dedupingTimelines,  setDedupingTimelines]  = useState(false);

  // 수집 재시작 확인 모달
  const [showRetriggerConfirm, setShowRetriggerConfirm] = useState(false);

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

  // ── 수집 활성 ON/OFF ──────────────────────────────────────────────────────
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

  function handleApproveGameWithCheck(appid: string) {
    const game = orderedGames.find((g) => String(g.appid) === appid);
    if (!game) return;
    const total     = Number(game.totalReviews || 0);
    const collected = Number(game.collected_reviews_count || 0);
    if (total > 0 && collected < total * 0.95) {
      setApproveConfirmGame(game);
      return;
    }
    handleApproveGame(appid);
  }

  async function handleApproveOnly(appid: string) {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setApproveOnlyIds((prev) => new Set(prev).add(appid));
    try {
      const res = await fetch("/api/admin/approve-only", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw, appid }),
      });
      const data = await res.json();
      if (data.ok) {
        show("AI 분석 승인 완료. 리뷰 수집 완료 후 다음 월간 분석 시 자동 실행됩니다.", "success");
        setApproveConfirmGame(null);
        router.refresh();
      } else {
        show(data.error ?? "오류가 발생했습니다.", "error");
      }
    } catch {
      show("서버 연결 오류", "error");
    } finally {
      setApproveOnlyIds((prev) => { const s = new Set(prev); s.delete(appid); return s; });
    }
  }

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

  // ── 대표 AI 분석 ──────────────────────────────────────────────────────────
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
        show("대표 AI 분석을 시작했습니다. 수 분 내 완료됩니다.", "success");
      } else {
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
    } finally {
      setCoreAnalyzingIds((prev) => { const s = new Set(prev); s.delete(appid); return s; });
    }
  }

  // ── 타임라인 AI 분석 ──────────────────────────────────────────────────────
  async function handleTimelineAnalyze(appid: string) {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setTimelineAnalyzingIds((prev) => new Set(prev).add(appid));
    try {
      const res = await fetch("/api/admin/analyze-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw, appid }),
      });
      const data = await res.json();
      if (data.ok) {
        show("타임라인 AI 분석을 시작했습니다. 완료까지 수 분~수십 분 소요됩니다.", "success");
      } else {
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
    } finally {
      setTimelineAnalyzingIds((prev) => { const s = new Set(prev); s.delete(appid); return s; });
    }
  }

  // ── 특정 구간 재분석 ──────────────────────────────────────────────────────
  async function handleAnalyzeMonth(appid: string, yearMonth: string) {
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      show("올바른 형식으로 입력해주세요 (예: 2024-03)", "error");
      return;
    }
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setMonthInputGame(null);
    setMonthInputVal("");
    setMonthAnalyzingIds((prev) => new Set(prev).add(appid));
    try {
      const res = await fetch("/api/admin/analyze-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw, appid, year_month: yearMonth }),
      });
      const data = await res.json();
      if (data.ok) {
        show(`${yearMonth} 구간 재분석을 시작했습니다.`, "success");
      } else {
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
    } finally {
      setMonthAnalyzingIds((prev) => { const s = new Set(prev); s.delete(appid); return s; });
    }
  }

  // ── 이벤트/뉴스 수집 ──────────────────────────────────────────────────────
  async function handleCollectNews(appid: string) {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setCollectNewsIds((prev) => new Set(prev).add(appid));
    try {
      const res = await fetch("/api/admin/collect-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw, appid }),
      });
      const data = await res.json();
      if (data.ok) {
        show("이벤트/뉴스 수집을 시작했습니다. 수 분 내 완료됩니다.", "success");
      } else {
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
    } finally {
      setCollectNewsIds((prev) => { const s = new Set(prev); s.delete(appid); return s; });
    }
  }

  // ── 수집 재시작 ──────────────────────────────────────────────────────────
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
        show("수집 재시작을 요청했습니다. 전체 게임 리뷰·뉴스 수집이 시작됩니다.", "success");
      } else {
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
    } finally {
      setRetriggering(false);
    }
  }

  // ── 언어 분포 재집계 ──────────────────────────────────────────────────────
  async function handleRecalcLangDist() {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setRecalcingLangDist(true);
    try {
      const res = await fetch("/api/admin/recalc-lang-dist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw }),
      });
      const data = await res.json();
      if (data.ok) {
        show("언어 분포 재집계를 시작했습니다. 수 분 내 완료됩니다.", "success");
      } else {
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
    } finally {
      setRecalcingLangDist(false);
    }
  }

  // ── 타임라인 중복 정리 ────────────────────────────────────────────────────
  async function handleDedupTimelines() {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setDedupingTimelines(true);
    try {
      const res = await fetch("/api/admin/dedup-timelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw }),
      });
      const data = await res.json();
      if (data.ok) {
        show("타임라인 중복 정리를 시작했습니다. 수 분 내 완료됩니다.", "success");
      } else {
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
    } finally {
      setDedupingTimelines(false);
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

  // ── 평가 급변 감지 ────────────────────────────────────────────────────────
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

  // ── 드래그 순서 ───────────────────────────────────────────────────────────
  function handleDragStart(idx: number) { setDragIdx(idx); }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx !== null && dragOverIdx !== idx) setDragOverIdx(idx);
  }
  function handleDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null); setDragOverIdx(null); return;
    }
    const next = [...orderedGames];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(targetIdx, 0, moved);
    setOrderedGames(next);
    setDragIdx(null); setDragOverIdx(null);
    saveSortOrders(next);
  }
  function handleDragEnd() { setDragIdx(null); setDragOverIdx(null); }

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
  const helpData = activeHelp ? COLUMN_HELP[activeHelp] : null;

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-10">

      {/* ── 헤더 ─────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">{t("ADMIN_PAGE_TITLE")}</h1>
        <p className="text-sm text-text-muted mt-1">{t("ADMIN_PAGE_SUBTITLE")}</p>
      </div>

      {/* ── 게임 현황 테이블 ──────────────────────────────────────────────── */}
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
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-border-default bg-bg-secondary">
                  {/* 게임 */}
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">
                    {t("ADMIN_COL_GAME")}
                  </th>
                  {/* 수집 상태 */}
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
                  {/* 리뷰 */}
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">
                    <span className="inline-flex items-center gap-0.5">
                      리뷰
                      <HelpBtn col="reviews" onClick={setActiveHelp} />
                    </span>
                  </th>
                  {/* 수집/분석 날짜 */}
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">
                    <span className="inline-flex items-center gap-0.5">
                      {t("ADMIN_COL_LAST_ANALYSIS")}
                      <HelpBtn col="dates" onClick={setActiveHelp} />
                    </span>
                  </th>
                  {/* 순서 */}
                  <th className="text-center px-2 py-3 text-xs font-medium text-text-muted w-10">
                    {t("ADMIN_COL_ORDER")}
                  </th>
                  {/* 액션 */}
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">
                    {t("ADMIN_COL_ACTION")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {orderedGames.map((game, i) => {
                  const appid      = String(game.appid);
                  const isActive   = game.status === "active";
                  const isArchived = game.status === "archived";
                  const canToggle  = isActive || isArchived;
                  const isApproved = String(game.ai_approved ?? "").toLowerCase() === "true";
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
                      } ${isDragging ? "opacity-40" : ""} ${
                        isDragOver ? "border-t-2 border-accent-blue bg-accent-blue/5" : ""
                      }`}
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

                      {/* 수집 상태 ON/OFF */}
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

                      {/* AI 승인 — 클릭으로 승인/취소 */}
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
                              onClick={() => handleApproveGameWithCheck(appid)}
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

                      {/* 리뷰 수집 / Steam 총계 */}
                      <td className="px-4 py-3 text-xs">
                        <div>
                          <span className="text-[10px] text-text-muted">수집 </span>
                          <span className="text-text-primary font-medium">
                            {Number(game.collected_reviews_count ?? 0).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-text-muted">Steam총계 </span>
                          <span className="text-text-secondary">
                            {Number(game.totalReviews ?? 0).toLocaleString()}
                          </span>
                        </div>
                        {/* 자동 재분석 뱃지 */}
                        {(() => {
                          const lastCount = Number(game.last_analyzed_review_count || 0);
                          const curCount  = Number(game.collected_reviews_count || 0);
                          if (lastCount > 0 && curCount > lastCount * 1.10) {
                            return (
                              <span
                                className="block mt-0.5 text-[10px] text-accent-green font-medium"
                                title={`직전 분석 ${lastCount.toLocaleString()}건 → 현재 ${curCount.toLocaleString()}건 (${Math.round((curCount / lastCount - 1) * 100)}% 증가) — 다음 분석 시 완료된 월도 자동 재분석됩니다`}
                              >
                                ↑ 자동 재분석 예정
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </td>

                      {/* 마지막 수집 / AI 분석 날짜 */}
                      <td className="px-4 py-3 text-xs">
                        <div className="space-y-0.5">
                          <div>
                            <span className="text-text-muted text-[10px]">{t("ADMIN_COL_COLLECT_DATE")}</span>
                            <span className="text-text-secondary">{game.last_event_date || "—"}</span>
                          </div>
                          <div>
                            <span className="text-text-muted text-[10px]">{t("ADMIN_COL_ANALYZE_DATE")}</span>
                            <span className="text-text-secondary">{game.ai_briefing_date || "—"}</span>
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
                          {isActive && isApproved && (
                            <>
                              {/* 대표 AI 분석 */}
                              <button
                                onClick={() => handleCoreAnalyze(appid)}
                                disabled={coreAnalyzingIds.has(appid)}
                                title="수집 없이 현재 데이터 기준으로 AI 현황 진단 · CCU 피크타임 · 평가 추이 종합 진단 · 언어권 교차 분석 4가지를 재실행합니다"
                                className="px-2.5 py-1 text-[11px] bg-accent-blue/10 border border-accent-blue/30 text-accent-blue rounded hover:bg-accent-blue/20 transition-colors disabled:opacity-40 whitespace-nowrap"
                              >
                                {coreAnalyzingIds.has(appid) ? "처리 중" : "대표AI"}
                              </button>

                              {/* 타임라인 AI 분석 */}
                              <button
                                onClick={() => handleTimelineAnalyze(appid)}
                                disabled={timelineAnalyzingIds.has(appid)}
                                title="수집 없이 현재 데이터로 전체 타임라인 월별 리뷰·이벤트를 재분석합니다. 완료 후 평가 급변 감지도 자동 실행됩니다."
                                className="px-2.5 py-1 text-[11px] bg-accent-green/10 border border-accent-green/30 text-accent-green rounded hover:bg-accent-green/20 transition-colors disabled:opacity-40 whitespace-nowrap"
                              >
                                {timelineAnalyzingIds.has(appid) ? "처리 중" : "타임라인AI"}
                              </button>

                              {/* 구간 재분석 */}
                              <button
                                onClick={() => { setMonthInputGame(appid); setMonthInputVal(""); }}
                                disabled={monthAnalyzingIds.has(appid)}
                                title="YYYY-MM 형식으로 년월을 입력해 해당 타임라인 구간만 선택 재분석합니다"
                                className="px-2.5 py-1 text-[11px] bg-accent-yellow/10 border border-accent-yellow/30 text-accent-yellow rounded hover:bg-accent-yellow/20 transition-colors disabled:opacity-40 whitespace-nowrap"
                              >
                                {monthAnalyzingIds.has(appid) ? "처리 중" : "구간재분석"}
                              </button>
                            </>
                          )}

                          {/* 이벤트/뉴스 수집 — active 게임 전체 */}
                          {isActive && (
                            <button
                              onClick={() => handleCollectNews(appid)}
                              disabled={collectNewsIds.has(appid)}
                              title="메타데이터·이벤트·뉴스를 최신화합니다. 이미 수집된 항목은 제외하고 신규 항목만 추가합니다. 리뷰 수집은 제외됩니다."
                              className="px-2.5 py-1 text-[11px] bg-bg-secondary border border-border-default text-text-secondary rounded hover:border-accent-blue/40 hover:text-accent-blue transition-colors disabled:opacity-40 whitespace-nowrap"
                            >
                              {collectNewsIds.has(appid) ? "처리 중" : "뉴스수집"}
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

        {pendingAiGames.length > 0 && (
          <p className="mt-3 text-xs text-accent-orange">
            {t("ADMIN_PENDING_WARNING", { n: pendingAiGames.length })}
          </p>
        )}
      </section>

      {/* ── 시스템 도구 ───────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-accent-orange rounded-full" />
          {t("ADMIN_SECTION_TOOLS")}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

          {/* 미분석 AI 분석 */}
          <div className="bg-bg-card border border-border-default rounded-xl p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">⚡</span>
              <div>
                <p className="font-semibold text-text-primary text-sm mb-1">미분석 AI 분석</p>
                <p className="text-xs text-text-muted leading-relaxed">
                  아직 AI 분석이 진행되지 않은 구간을 자동 선별해 현재 데이터 기준으로 분석합니다.
                  월별 타임라인, CCU 피크타임, 종합 분석, 언어 분포 등 모든 AI 분석 항목을 대상으로 합니다.
                </p>
              </div>
            </div>
            <button
              onClick={handleAnalyzePending}
              disabled={analyzingPending}
              className="w-full py-2 text-sm border border-accent-blue/40 rounded-lg text-accent-blue hover:bg-accent-blue/10 transition-colors disabled:opacity-40"
            >
              {analyzingPending ? "처리 중..." : "⚡ 미분석 분석 실행"}
            </button>
          </div>

          {/* 평가 급변 감지 */}
          <div className="bg-bg-card border border-border-default rounded-xl p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">🔍</span>
              <div>
                <p className="font-semibold text-text-primary text-sm mb-1">평가 급변 감지</p>
                <p className="text-xs text-text-muted leading-relaxed">
                  전체 active 게임의 긍정률 급변 구간을 탐지하고, 이상 감지 시 AI 원인 분석을 실행합니다.
                  이미 감지된 구간은 건너뛰고 신규 구간에 대해서만 진행합니다. 매주 월요일 자동 실행됩니다.
                </p>
              </div>
            </div>
            <button
              onClick={handleDetectShifts}
              disabled={detectingShifts}
              className="w-full py-2 text-sm border border-accent-yellow/40 rounded-lg text-accent-yellow hover:bg-accent-yellow/10 transition-colors disabled:opacity-40"
            >
              {detectingShifts ? "처리 중..." : "🔍 급변 감지 실행"}
            </button>
          </div>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* 수집 재시작 */}
          <div className="bg-bg-card border border-border-default rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">🔄</span>
              <div>
                <p className="font-semibold text-text-primary text-sm mb-1">수집 재시작</p>
                <p className="text-xs text-text-muted leading-relaxed">
                  일일 봇 스케줄과 무관하게 전체 게임 리뷰·이벤트·뉴스 수집을 즉시 트리거합니다.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowRetriggerConfirm(true)}
              disabled={retriggering}
              className="w-full py-2 text-sm border border-border-default rounded-lg text-text-secondary hover:border-accent-blue/50 hover:text-accent-blue transition-colors disabled:opacity-40 mt-auto"
            >
              {retriggering ? "처리 중..." : "🔄 수집 재시작"}
            </button>
          </div>

          {/* 언어 분포 재집계 */}
          <div className="bg-bg-card border border-border-default rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">📊</span>
              <div>
                <p className="font-semibold text-text-primary text-sm mb-1">언어 분포 재집계</p>
                <p className="text-xs text-text-muted leading-relaxed">
                  전체 게임 RAW 리뷰 기반 언어 분포 JSON을 강제 재계산합니다.
                  파이 차트 데이터·상위 언어 목록·수집 건수 보정이 함께 갱신됩니다.
                </p>
              </div>
            </div>
            <button
              onClick={handleRecalcLangDist}
              disabled={recalcingLangDist}
              className="w-full py-2 text-sm border border-accent-blue/40 rounded-lg text-accent-blue hover:bg-accent-blue/10 transition-colors disabled:opacity-40 mt-auto"
            >
              {recalcingLangDist ? "처리 중..." : "📊 재집계 실행"}
            </button>
          </div>

          {/* 타임라인 중복 정리 */}
          <div className="bg-bg-card border border-border-default rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">🧹</span>
              <div>
                <p className="font-semibold text-text-primary text-sm mb-1">타임라인 중복 정리</p>
                <p className="text-xs text-text-muted leading-relaxed">
                  전체 게임 타임라인에서 중복 이벤트를 일괄 검사하고 제거합니다.
                  뒤에서부터 역순으로 삭제해 인덱스 오염을 방지합니다.
                </p>
              </div>
            </div>
            <button
              onClick={handleDedupTimelines}
              disabled={dedupingTimelines}
              className="w-full py-2 text-sm border border-border-default rounded-lg text-text-secondary hover:border-accent-orange/50 hover:text-accent-orange transition-colors disabled:opacity-40 mt-auto"
            >
              {dedupingTimelines ? "처리 중..." : "🧹 중복 정리 실행"}
            </button>
          </div>

        </div>
      </section>

      {/* ── 워크플로우 현황 ──────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-accent-green rounded-full" />
          GitHub Actions 워크플로우 현황
        </h2>
        <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-border-default bg-bg-secondary">
                <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">워크플로우</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">실행 주기</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">설명</th>
              </tr>
            </thead>
            <tbody>
              {([
                { name: "CCU 수집",          schedule: "매 시간 정각",      desc: "active 게임의 동접자를 Steam API로 수집해 개별 시트에 적재합니다." },
                { name: "리뷰·뉴스 수집",    schedule: "매일 05:00 KST",    desc: "신규 리뷰·이벤트를 수집합니다. active 게임은 기존 수집 리뷰 ID를 미리 로드해 이미 수집한 페이지에 도달하면 즉시 조기 종료합니다. 게임 신규 등록 시 자동 트리거됩니다." },
                { name: "AI 월간 분석",       schedule: "매월 1일 09:00 KST", desc: "AI 승인된 게임의 월별 감성 분석·패치 요약·AI 브리핑·CCU·언어권 교차 분석을 실행합니다. 직전 분석 이후 리뷰가 10% 이상 증가한 경우 완료된 월도 자동 재분석합니다." },
                { name: "평가 급변 감지",    schedule: "매주 월 11:00 KST", desc: "전체 기간 긍정률 변화를 분석해 급락·회복 구간을 탐지하고 AI 원인 분석을 수행합니다. 이미 감지된 구간은 재분석하지 않습니다." },
                { name: "대표AI 분석",        schedule: "수동 (게임별)",     desc: "수집 없이 현재 데이터로 AI 현황 진단·CCU 피크타임·평가 추이·언어권 교차 분석 4가지를 즉시 재실행합니다. 게임별 [대표AI] 버튼으로 트리거." },
                { name: "타임라인AI 분석",    schedule: "수동 (게임별)",     desc: "수집 없이 현재 데이터로 전체 타임라인 월별 재분석 후 평가 급변 감지를 실행합니다. 게임별 [타임라인AI] 버튼으로 트리거." },
                { name: "구간 재분석",        schedule: "수동 (게임별)",     desc: "YYYY-MM 입력으로 특정 월의 타임라인 구간만 선택 재분석합니다. 해당 게임에 없는 년월 입력 시 분석을 건너뜁니다. 게임별 [구간재분석] 버튼으로 트리거." },
                { name: "이벤트/뉴스 수집",   schedule: "수동 (게임별)",     desc: "메타데이터·이벤트·뉴스를 최신화합니다. 이미 수집된 항목은 제외하고 신규 항목만 추가합니다. 리뷰 수집은 제외됩니다. 게임별 [뉴스수집] 버튼으로 트리거." },
                { name: "미분석 AI 분석",     schedule: "수동 (시스템)",     desc: "AI 분석이 진행되지 않은 구간을 전 게임 대상으로 선별해 일괄 분석합니다. 시스템 도구 [미분석 분석 실행] 버튼으로 트리거." },
                { name: "수집 재시작",        schedule: "수동 (시스템)",     desc: "일일 봇 스케줄과 무관하게 전체 게임 리뷰·이벤트·뉴스 수집을 즉시 트리거합니다. 시스템 도구 [수집 재시작] 버튼으로 트리거." },
                { name: "언어 분포 재집계",   schedule: "수동 (시스템)",     desc: "전체 게임 RAW 리뷰 언어 분포를 재계산해 language_distribution·top_languages·수집 건수를 갱신합니다. 시스템 도구 [재집계 실행] 버튼으로 트리거." },
                { name: "타임라인 중복 정리", schedule: "수동 (시스템)",     desc: "전체 게임 타임라인 탭에서 중복 이벤트를 일괄 검사·제거합니다. 시스템 도구 [중복 정리 실행] 버튼으로 트리거." },
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

      {/* ── 도움말 모달 ──────────────────────────────────────────────────── */}
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

      {/* ── 구간 재분석 입력 모달 ────────────────────────────────────────── */}
      {monthInputGame && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setMonthInputGame(null)}
        >
          <div
            className="bg-bg-card border border-border-default rounded-xl p-6 w-[360px] max-w-[calc(100vw-2rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-semibold text-text-primary mb-1">구간 재분석</p>
            <p className="text-xs text-text-muted mb-4 leading-relaxed">
              재분석할 년월을 입력하세요. 해당 게임의 타임라인에 없는 년월이면 분석을 건너뜁니다.
            </p>
            <input
              type="text"
              value={monthInputVal}
              onChange={(e) => setMonthInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && monthInputVal) handleAnalyzeMonth(monthInputGame, monthInputVal);
                if (e.key === "Escape") setMonthInputGame(null);
              }}
              placeholder="예: 2024-03"
              maxLength={7}
              className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-yellow mb-4 font-mono tracking-wider"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleAnalyzeMonth(monthInputGame, monthInputVal)}
                disabled={!monthInputVal || !/^\d{4}-\d{2}$/.test(monthInputVal)}
                className="flex-1 py-2 bg-accent-yellow/20 border border-accent-yellow/40 text-accent-yellow rounded-lg text-sm disabled:opacity-40 hover:bg-accent-yellow/30 transition-colors"
              >
                재분석 시작
              </button>
              <button
                onClick={() => setMonthInputGame(null)}
                className="flex-1 py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover transition-colors"
              >
                {t("ADMIN_BTN_CANCEL")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 수집 재시작 확인 모달 ────────────────────────────────────────── */}
      {showRetriggerConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-card border border-border-default rounded-xl p-6 w-80">
            <p className="font-semibold text-text-primary mb-1">🔄 수집 재시작</p>
            <p className="text-xs text-text-muted mb-5 leading-relaxed">
              전체 active 게임의 리뷰·이벤트·뉴스 수집을 즉시 시작합니다.<br />
              일일 자동 수집과 병렬 실행될 수 있습니다. 계속하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRetriggerCollect}
                disabled={retriggering}
                className="flex-1 py-2 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue rounded-lg text-sm disabled:opacity-40"
              >
                {retriggering ? "처리 중..." : "확인"}
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

      {/* ── AI 승인 — 수집 미완료 경고 모달 ─────────────────────────────── */}
      {approveConfirmGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-card border border-border-default rounded-xl p-6 w-[420px] max-w-[calc(100vw-2rem)]">
            <p className="font-semibold text-text-primary mb-1">⚠️ 리뷰 수집 미완료</p>
            <p className="text-xs text-text-muted mb-5 leading-relaxed">
              <span className="font-medium text-text-secondary">
                {approveConfirmGame.name_kr || approveConfirmGame.name}
              </span>의 리뷰가 아직 모두 수집되지 않았습니다.<br />
              <span className="text-accent-orange font-medium">
                {Number(approveConfirmGame.collected_reviews_count || 0).toLocaleString()}건 수집
                / Steam 총 {Number(approveConfirmGame.totalReviews || 0).toLocaleString()}건
              </span><br />
              이 상태에서 AI 분석을 실행하면 일부 기간이 불완전한 데이터로 분석됩니다.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  handleApproveGame(String(approveConfirmGame.appid));
                  setApproveConfirmGame(null);
                }}
                disabled={approvingIds.has(String(approveConfirmGame.appid))}
                className="w-full py-2.5 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue rounded-lg text-sm disabled:opacity-40 hover:bg-accent-blue/30 transition-colors"
              >
                {approvingIds.has(String(approveConfirmGame.appid)) ? "처리 중..." : "🚀 지금 기준으로 AI 분석 시작"}
              </button>
              <button
                onClick={() => handleApproveOnly(String(approveConfirmGame.appid))}
                disabled={approveOnlyIds.has(String(approveConfirmGame.appid))}
                className="w-full py-2.5 bg-bg-secondary border border-border-default text-text-secondary rounded-lg text-sm disabled:opacity-40 hover:border-accent-blue/40 transition-colors"
              >
                {approveOnlyIds.has(String(approveConfirmGame.appid)) ? "처리 중..." : "⏳ 리뷰 수집 완료 후 분석하기 (승인만)"}
              </button>
              <button
                onClick={() => setApproveConfirmGame(null)}
                className="w-full py-2 text-text-muted text-sm hover:text-text-secondary transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}
