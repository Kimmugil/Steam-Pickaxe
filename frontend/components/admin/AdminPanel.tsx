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

// ── 버튼 색상 규칙 ───────────────────────────────────────────────────────────
// 🔵 파란색  (accent-blue)   = AI 분석    — Gemini 분석 실행 (대표AI, 타임라인AI, 미분석AI)
// 🟢 초록색  (accent-green)  = 수집       — Steam 외부 데이터 수집 (뉴스수집, 수집재시작)
// 🟡 노란색  (accent-yellow) = 감지·주의  — 탐지 작업 또는 사용자 입력 필요 (구간재분석, 급변감지)
// ⚫ 회색    (text-secondary) = 유지보수   — 내부 데이터 정리·보정 (언어분포재집계, 타임라인중복정리)

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
      title: t("HELP_REVIEWS_TITLE"),
      lines: [t("HELP_REVIEWS_L1"), t("HELP_REVIEWS_L2"), t("HELP_REVIEWS_L4")],
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

  // AI 승인
  const [approveConfirmGame, setApproveConfirmGame] = useState<Game | null>(null);
  const [approveOnlyIds, setApproveOnlyIds] = useState<Set<string>>(new Set());

  // 구간 재분석 입력 모달
  const [monthInputGame, setMonthInputGame] = useState<string | null>(null);
  const [monthInputVal, setMonthInputVal] = useState("");

  // ── 게임별 액션 로딩 상태 ─────────────────────────────────────────────────
  const [togglingIds,              setTogglingIds]              = useState<Set<string>>(new Set());
  const [approvingIds,             setApprovingIds]             = useState<Set<string>>(new Set());
  const [unapprovingIds,           setUnapprovingIds]           = useState<Set<string>>(new Set());
  const [coreAnalyzingIds,         setCoreAnalyzingIds]         = useState<Set<string>>(new Set());
  const [timelineAnalyzingIds,     setTimelineAnalyzingIds]     = useState<Set<string>>(new Set());
  const [monthAnalyzingIds,        setMonthAnalyzingIds]        = useState<Set<string>>(new Set());
  const [earlyLaunchAnalyzingIds,  setEarlyLaunchAnalyzingIds]  = useState<Set<string>>(new Set());
  const [collectNewsIds,           setCollectNewsIds]           = useState<Set<string>>(new Set());

  // ── 시스템 도구 로딩 상태 ────────────────────────────────────────────────
  const [analyzingPending,      setAnalyzingPending]      = useState(false);
  const [detectingShifts,       setDetectingShifts]       = useState(false);
  const [retriggering,          setRetriggering]          = useState(false);
  const [recalcingLangDist,     setRecalcingLangDist]     = useState(false);
  const [dedupingTimelines,     setDedupingTimelines]     = useState(false);
  const [backfillingEventUrls,  setBackfillingEventUrls]  = useState(false);

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
    const game = allGames.find((g) => String(g.appid) === appid);
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
        show(t("ADMIN_TOAST_APPROVE_ONLY"), "success");
        setApproveConfirmGame(null);
        router.refresh();
      } else {
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
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
        show(t("ADMIN_TOAST_TIMELINE_ANALYZE"), "success");
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
      show(t("ADMIN_MONTH_FORMAT_ERROR"), "error");
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
        show(t("ADMIN_TOAST_MONTH_REANALYZE", { ym: yearMonth }), "success");
      } else {
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
    } finally {
      setMonthAnalyzingIds((prev) => { const s = new Set(prev); s.delete(appid); return s; });
    }
  }

  // ── 출시 초기 주간 재분석 ────────────────────────────────────────────────
  async function handleEarlyLaunchAnalyze(appid: string) {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setEarlyLaunchAnalyzingIds((prev) => new Set(prev).add(appid));
    try {
      const res = await fetch("/api/admin/analyze-early-launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw, appid }),
      });
      const data = await res.json();
      if (data.ok) {
        show(t("ADMIN_TOAST_EARLY_LAUNCH"), "success");
      } else {
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
    } finally {
      setEarlyLaunchAnalyzingIds((prev) => { const s = new Set(prev); s.delete(appid); return s; });
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
        show(t("ADMIN_TOAST_COLLECT_NEWS"), "success");
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
        show(t("ADMIN_TOAST_RECALC_LANG"), "success");
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
        show(t("ADMIN_TOAST_DEDUP_TIMELINES"), "success");
      } else {
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
    } finally {
      setDedupingTimelines(false);
    }
  }

  // ── 이벤트 URL 백필 ──────────────────────────────────────────────────────
  async function handleBackfillEventUrls() {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setBackfillingEventUrls(true);
    try {
      const res = await fetch("/api/admin/backfill-event-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw }),
      });
      const data = await res.json();
      if (data.ok) {
        show(`이벤트 URL 백필 완료 — 업데이트 ${data.updated}건 / 스킵 ${data.skipped}건`, "success");
      } else {
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
    } finally {
      setBackfillingEventUrls(false);
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
        show(t("ADMIN_TOAST_DETECT_SHIFTS"), "success");
      } else {
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
    } finally {
      setDetectingShifts(false);
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
          <span className="text-xs font-normal text-text-muted">({allGames.length}개)</span>
        </h2>

        {allGames.length === 0 ? (
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
                      {t("ADMIN_COL_REVIEWS_TH")}
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
                  {/* 액션 */}
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">
                    {t("ADMIN_COL_ACTION")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...allGames].sort((a, b) => (a.name_kr || a.name).localeCompare(b.name_kr || b.name)).map((game) => {
                  const appid      = String(game.appid);
                  const isActive   = game.status === "active";
                  const isArchived = game.status === "archived";
                  const canToggle  = isActive || isArchived;
                  const isApproved = String(game.ai_approved ?? "").toLowerCase() === "true";

                  return (
                    <tr
                      key={appid}
                      className={`border-b border-border-default last:border-b-0 transition-colors ${isArchived ? "opacity-60" : "hover:bg-bg-secondary/50"}`}
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
                          <span className="text-[10px] text-text-muted">{t("ADMIN_LABEL_COLLECTED")} </span>
                          <span className="text-text-primary font-medium">
                            {Number(game.collected_reviews_count ?? 0).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-text-muted">{t("ADMIN_LABEL_STEAM_TOTAL")} </span>
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
                                title={t("ADMIN_BADGE_AUTO_REANALYZE_TITLE", {
                                  last: lastCount.toLocaleString(),
                                  cur: curCount.toLocaleString(),
                                  pct: String(Math.round((curCount / lastCount - 1) * 100)),
                                })}
                              >
                                {t("ADMIN_BADGE_AUTO_REANALYZE")}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </td>

                      {/* 마지막 수집 / AI 분석 날짜 (KST 기준) */}
                      <td className="px-4 py-3 text-xs">
                        <div className="space-y-0.5">
                          <div>
                            <span className="text-text-muted text-[10px]">{t("ADMIN_COL_COLLECT_DATE")}</span>
                            <span className="text-text-secondary">{game.last_event_date || "—"}</span>
                          </div>
                          <div>
                            <span className="text-text-muted text-[10px]">{t("ADMIN_COL_ANALYZE_DATE")}</span>
                            <span className="text-text-secondary">{game.ai_briefing_date || "—"}</span>
                            {game.ai_briefing_date && (
                              <span className="ml-1 text-[9px] text-text-muted">KST</span>
                            )}
                          </div>
                        </div>
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
                                title={t("ADMIN_BTN_CORE_ANALYZE_TITLE")}
                                className="px-2.5 py-1 text-[11px] bg-accent-blue/10 border border-accent-blue/30 text-accent-blue rounded hover:bg-accent-blue/20 transition-colors disabled:opacity-40 whitespace-nowrap"
                              >
                                {coreAnalyzingIds.has(appid) ? t("PROCESSING") : t("ADMIN_BTN_CORE_ANALYZE")}
                              </button>

                              {/* 타임라인 AI 분석 */}
                              <button
                                onClick={() => handleTimelineAnalyze(appid)}
                                disabled={timelineAnalyzingIds.has(appid)}
                                title={t("ADMIN_BTN_TIMELINE_ANALYZE_TITLE")}
                                className="px-2.5 py-1 text-[11px] bg-accent-blue/10 border border-accent-blue/30 text-accent-blue rounded hover:bg-accent-blue/20 transition-colors disabled:opacity-40 whitespace-nowrap"
                              >
                                {timelineAnalyzingIds.has(appid) ? t("PROCESSING") : t("ADMIN_BTN_TIMELINE_ANALYZE")}
                              </button>

                              {/* 구간 재분석 */}
                              <button
                                onClick={() => { setMonthInputGame(appid); setMonthInputVal(""); }}
                                disabled={monthAnalyzingIds.has(appid)}
                                title={t("ADMIN_BTN_MONTH_REANALYZE_TITLE")}
                                className="px-2.5 py-1 text-[11px] bg-accent-yellow/10 border border-accent-yellow/30 text-accent-yellow rounded hover:bg-accent-yellow/20 transition-colors disabled:opacity-40 whitespace-nowrap"
                              >
                                {monthAnalyzingIds.has(appid) ? t("PROCESSING") : t("ADMIN_BTN_MONTH_REANALYZE")}
                              </button>

                              {/* 출시 초기 주간 재분석 */}
                              {game.release_date && (
                                <button
                                  onClick={() => handleEarlyLaunchAnalyze(appid)}
                                  disabled={earlyLaunchAnalyzingIds.has(appid)}
                                  title={t("ADMIN_BTN_EARLY_LAUNCH_TITLE")}
                                  className="px-2.5 py-1 text-[11px] bg-accent-yellow/10 border border-accent-yellow/30 text-accent-yellow rounded hover:bg-accent-yellow/20 transition-colors disabled:opacity-40 whitespace-nowrap"
                                >
                                  {earlyLaunchAnalyzingIds.has(appid) ? t("PROCESSING") : t("ADMIN_BTN_EARLY_LAUNCH")}
                                </button>
                              )}
                            </>
                          )}

                          {/* 이벤트/뉴스 수집 — active 게임 전체 */}
                          {isActive && (
                            <button
                              onClick={() => handleCollectNews(appid)}
                              disabled={collectNewsIds.has(appid)}
                              title={t("ADMIN_BTN_COLLECT_NEWS_TITLE")}
                              className="px-2.5 py-1 text-[11px] bg-accent-green/10 border border-accent-green/30 text-accent-green rounded hover:bg-accent-green/20 transition-colors disabled:opacity-40 whitespace-nowrap"
                            >
                              {collectNewsIds.has(appid) ? t("PROCESSING") : t("ADMIN_BTN_COLLECT_NEWS")}
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
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <span className="w-2 h-2 bg-accent-orange rounded-full" />
            {t("ADMIN_SECTION_TOOLS")}
          </h2>
          {/* 버튼 색상 범례 */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent-blue inline-block flex-shrink-0" />
              {t("ADMIN_LEGEND_AI")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent-green inline-block flex-shrink-0" />
              {t("ADMIN_LEGEND_COLLECT")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent-yellow inline-block flex-shrink-0" />
              {t("ADMIN_LEGEND_DETECT")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-border-default inline-block flex-shrink-0" />
              {t("ADMIN_LEGEND_MAINTAIN")}
            </span>
          </div>
        </div>

        <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
          {[
            {
              icon: "⚡", title: t("ADMIN_TOOL_PENDING_TITLE"), desc: t("ADMIN_TOOL_PENDING_DESC"),
              btnLabel: t("ADMIN_BTN_ANALYZE_PENDING_EXEC"), loading: analyzingPending,
              onClick: handleAnalyzePending,
              btnClass: "border-accent-blue/40 text-accent-blue hover:bg-accent-blue/10",
            },
            {
              icon: "🔍", title: t("ADMIN_TOOL_SHIFTS_TITLE"), desc: t("ADMIN_TOOL_SHIFTS_DESC"),
              btnLabel: t("ADMIN_BTN_DETECT_SHIFTS_EXEC"), loading: detectingShifts,
              onClick: handleDetectShifts,
              btnClass: "border-accent-yellow/40 text-accent-yellow hover:bg-accent-yellow/10",
            },
            {
              icon: "🔄", title: t("ADMIN_TOOL_RETRIGGER_TITLE"), desc: t("ADMIN_TOOL_RETRIGGER_DESC"),
              btnLabel: t("ADMIN_BTN_RETRIGGER_EXEC"), loading: retriggering,
              onClick: () => setShowRetriggerConfirm(true),
              btnClass: "border-accent-green/40 text-accent-green hover:bg-accent-green/10",
            },
            {
              icon: "📊", title: t("ADMIN_TOOL_RECALC_TITLE"), desc: t("ADMIN_TOOL_RECALC_DESC"),
              btnLabel: t("ADMIN_BTN_RECALC_EXEC"), loading: recalcingLangDist,
              onClick: handleRecalcLangDist,
              btnClass: "border-border-default text-text-secondary hover:border-text-muted/50 hover:text-text-primary",
            },
            {
              icon: "🧹", title: t("ADMIN_TOOL_DEDUP_TITLE"), desc: t("ADMIN_TOOL_DEDUP_DESC"),
              btnLabel: t("ADMIN_BTN_DEDUP_EXEC"), loading: dedupingTimelines,
              onClick: handleDedupTimelines,
              btnClass: "border-border-default text-text-secondary hover:border-accent-orange/50 hover:text-accent-orange",
            },
            {
              icon: "🔗", title: "이벤트 URL 백필", desc: "타임라인에서 최신 공식 이벤트 URL을 master sheet에 소급 저장합니다.",
              btnLabel: "백필 실행", loading: backfillingEventUrls,
              onClick: handleBackfillEventUrls,
              btnClass: "border-border-default text-text-secondary hover:border-accent-orange/50 hover:text-accent-orange",
            },
          ].map((tool, i, arr) => (
            <div
              key={tool.title}
              className={`flex items-center gap-4 px-4 py-3 ${i < arr.length - 1 ? "border-b border-border-default" : ""}`}
            >
              <span className="text-lg w-6 text-center flex-shrink-0">{tool.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{tool.title}</p>
                <p className="text-xs text-text-muted leading-relaxed truncate">{tool.desc}</p>
              </div>
              <button
                onClick={tool.onClick}
                disabled={tool.loading}
                className={`flex-shrink-0 px-3 py-1.5 text-xs border rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap ${tool.btnClass}`}
              >
                {tool.loading ? t("PROCESSING") : tool.btnLabel}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── 워크플로우 현황 ──────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-accent-green rounded-full" />
          {t("ADMIN_SECTION_WORKFLOW")}
        </h2>
        <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-border-default bg-bg-secondary">
                <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">{t("TH_WORKFLOW")}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">{t("TH_WORKFLOW_SCHEDULE")}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">{t("TH_FUNC_DESC")}</th>
              </tr>
            </thead>
            <tbody>
              {([
                { name: t("ADMIN_WF_CCU_NAME"),       schedule: t("ADMIN_WF_CCU_SCHEDULE"),       desc: t("ADMIN_WF_CCU_DESC") },
                { name: t("ADMIN_WF_COLLECT_NAME"),   schedule: t("ADMIN_WF_COLLECT_SCHEDULE"),   desc: t("ADMIN_WF_COLLECT_DESC") },
                { name: t("ADMIN_WF_ANALYZE_NAME"),   schedule: t("ADMIN_WF_ANALYZE_SCHEDULE"),   desc: t("ADMIN_WF_ANALYZE_DESC") },
                { name: t("ADMIN_WF_SHIFTS_NAME"),    schedule: t("ADMIN_WF_SHIFTS_SCHEDULE"),    desc: t("ADMIN_WF_SHIFTS_DESC") },
                { name: t("ADMIN_WF_CORE_NAME"),      schedule: t("ADMIN_WF_CORE_SCHEDULE"),      desc: t("ADMIN_WF_CORE_DESC") },
                { name: t("ADMIN_WF_TIMELINE_NAME"),  schedule: t("ADMIN_WF_TIMELINE_SCHEDULE"),  desc: t("ADMIN_WF_TIMELINE_DESC") },
                { name: t("ADMIN_WF_MONTH_NAME"),     schedule: t("ADMIN_WF_MONTH_SCHEDULE"),     desc: t("ADMIN_WF_MONTH_DESC") },
                { name: t("ADMIN_WF_NEWS_NAME"),      schedule: t("ADMIN_WF_NEWS_SCHEDULE"),      desc: t("ADMIN_WF_NEWS_DESC") },
                { name: t("ADMIN_WF_PENDING_NAME"),   schedule: t("ADMIN_WF_PENDING_SCHEDULE"),   desc: t("ADMIN_WF_PENDING_DESC") },
                { name: t("ADMIN_WF_RETRIGGER_NAME"), schedule: t("ADMIN_WF_RETRIGGER_SCHEDULE"), desc: t("ADMIN_WF_RETRIGGER_DESC") },
                { name: t("ADMIN_WF_RECALC_NAME"),    schedule: t("ADMIN_WF_RECALC_SCHEDULE"),    desc: t("ADMIN_WF_RECALC_DESC") },
                { name: t("ADMIN_WF_DEDUP_NAME"),     schedule: t("ADMIN_WF_DEDUP_SCHEDULE"),     desc: t("ADMIN_WF_DEDUP_DESC") },
              ]).map((row, i) => (
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
            <p className="font-semibold text-text-primary mb-1">{t("ADMIN_MODAL_MONTH_INPUT_TITLE")}</p>
            <p className="text-xs text-text-muted mb-4 leading-relaxed">{t("ADMIN_MODAL_MONTH_INPUT_DESC")}</p>
            <input
              type="text"
              value={monthInputVal}
              onChange={(e) => setMonthInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && monthInputVal) handleAnalyzeMonth(monthInputGame, monthInputVal);
                if (e.key === "Escape") setMonthInputGame(null);
              }}
              placeholder={t("ADMIN_MODAL_MONTH_PLACEHOLDER")}
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
                {t("ADMIN_BTN_REANALYZE_EXEC")}
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
            <p className="font-semibold text-text-primary mb-1">{t("ADMIN_TOOL_RETRIGGER_TITLE")}</p>
            <p className="text-xs text-text-muted mb-5 leading-relaxed">{t("ADMIN_RETRIGGER_CONFIRM_DESC")}</p>
            <div className="flex gap-2">
              <button
                onClick={handleRetriggerCollect}
                disabled={retriggering}
                className="flex-1 py-2 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue rounded-lg text-sm disabled:opacity-40"
              >
                {retriggering ? t("PROCESSING") : t("ADMIN_BTN_CONFIRM")}
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
            <p className="font-semibold text-text-primary mb-1">{t("ADMIN_MODAL_INCOMPLETE_REVIEWS_TITLE")}</p>
            <p className="text-xs text-text-muted mb-5 leading-relaxed">
              {t("ADMIN_MODAL_INCOMPLETE_REVIEWS_DESC", { name: approveConfirmGame.name_kr || approveConfirmGame.name })}<br />
              <span className="text-accent-orange font-medium">
                {t("ADMIN_MODAL_INCOMPLETE_REVIEWS_COUNTS", {
                  collected: Number(approveConfirmGame.collected_reviews_count || 0).toLocaleString(),
                  total: Number(approveConfirmGame.totalReviews || 0).toLocaleString(),
                })}
              </span><br />
              {t("ADMIN_MODAL_INCOMPLETE_REVIEWS_WARN")}
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
                {approvingIds.has(String(approveConfirmGame.appid)) ? t("PROCESSING") : t("ADMIN_BTN_APPROVE_NOW")}
              </button>
              <button
                onClick={() => handleApproveOnly(String(approveConfirmGame.appid))}
                disabled={approveOnlyIds.has(String(approveConfirmGame.appid))}
                className="w-full py-2.5 bg-bg-secondary border border-border-default text-text-secondary rounded-lg text-sm disabled:opacity-40 hover:border-accent-blue/40 transition-colors"
              >
                {approveOnlyIds.has(String(approveConfirmGame.appid)) ? t("PROCESSING") : t("ADMIN_BTN_APPROVE_WAIT")}
              </button>
              <button
                onClick={() => setApproveConfirmGame(null)}
                className="w-full py-2 text-text-muted text-sm hover:text-text-secondary transition-colors"
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
