"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Toast, { useToast } from "@/components/shared/Toast";
import type { Game, GameStatus } from "@/types";

const SESSION_KEY = "steam_admin_pw";

const STATUS_LABELS: Record<GameStatus, string> = {
  active: "활성",
  collecting: "수집 중",
  archived: "숨김",
  error_pool_empty: "수집 오류",
};

const STATUS_COLORS: Record<GameStatus, string> = {
  active: "bg-accent-green/20 text-accent-green border-accent-green/30",
  collecting: "bg-accent-blue/20 text-accent-blue border-accent-blue/30",
  archived: "bg-bg-secondary text-text-muted border-border-default",
  error_pool_empty: "bg-accent-red/20 text-accent-red border-accent-red/30",
};

export default function AdminPanel({ allGames }: { allGames: Game[] }) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast, show, clear } = useToast();

  // 시스템 도구 상태
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [analyzingPending, setAnalyzingPending] = useState(false);
  const [showRetriggerConfirm, setShowRetriggerConfirm] = useState(false);
  const [retriggering, setRetriggering] = useState(false);

  // 게임별 액션 로딩 상태 (appid별)
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [unapprovingIds, setUnapprovingIds] = useState<Set<string>>(new Set());
  const [collectingMonthIds, setCollectingMonthIds] = useState<Set<string>>(new Set());
  const [reanalyzingIds, setReanalyzingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
        show("AI 분석 승인 완료. 곧 분석이 시작됩니다.", "success");
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
        show("AI 분석 승인이 취소되었습니다.", "success");
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
        show("이번 달 수집+분석을 시작했습니다. 수분 내 반영됩니다.", "success");
      } else {
        show(data.error ?? "오류가 발생했습니다.", "error");
      }
    } catch {
      show("서버 연결 오류", "error");
    } finally {
      setCollectingMonthIds((prev) => { const s = new Set(prev); s.delete(appid); return s; });
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
        show("AI 재분석을 요청했습니다. 수분 내 반영됩니다.", "success");
      } else {
        show(data.error ?? "오류가 발생했습니다.", "error");
      }
    } catch {
      show("서버 연결 오류", "error");
    } finally {
      setReanalyzingIds((prev) => { const s = new Set(prev); s.delete(appid); return s; });
    }
  }

  // ── 소프트 삭제 ───────────────────────────────────────────────────────────
  async function handleDelete(appid: string) {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setDeletingIds((prev) => new Set(prev).add(appid));
    setConfirmDeleteId(null);
    try {
      const res = await fetch("/api/admin/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw, appid }),
      });
      const data = await res.json();
      if (data.ok) {
        show("게임을 숨겼습니다. 데이터는 보존됩니다.", "success");
        router.refresh();
      } else {
        show(data.error ?? "오류가 발생했습니다.", "error");
      }
    } catch {
      show("서버 연결 오류", "error");
    } finally {
      setDeletingIds((prev) => { const s = new Set(prev); s.delete(appid); return s; });
    }
  }

  // ── 복원 ─────────────────────────────────────────────────────────────────
  async function handleRestore(appid: string) {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setRestoringIds((prev) => new Set(prev).add(appid));
    try {
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw, appid }),
      });
      const data = await res.json();
      if (data.ok) {
        show("게임을 복원했습니다.", "success");
        router.refresh();
      } else {
        show(data.error ?? "오류가 발생했습니다.", "error");
      }
    } catch {
      show("서버 연결 오류", "error");
    } finally {
      setRestoringIds((prev) => { const s = new Set(prev); s.delete(appid); return s; });
    }
  }

  // ── UI 텍스트 동기화 ──────────────────────────────────────────────────────
  async function handleSyncUiText(reset: boolean) {
    const savedPw = getSavedPw();
    if (!savedPw) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/sync-ui-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: savedPw, reset }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowSyncModal(false);
        if (reset) {
          show(`재설정 완료 — 유지 ${data.kept}건 / 추가 ${data.added}건 / 제거 ${data.removed}건`, "success");
        } else {
          show(`동기화 완료 — 추가 ${data.added}건 / 기존 유지 ${data.skipped}건`, "success");
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
        show("미분석 이벤트 AI 분석을 시작했습니다. 수분 내 반영됩니다.", "success");
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
        show("수집 워크플로우를 재시작했습니다. 수분 내 진행됩니다.", "success");
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
          <h1 className="text-lg font-semibold text-text-primary mb-1">관계자외 출입금지</h1>
          <p className="text-xs text-text-muted mb-6">관리자 비밀번호를 입력하세요.</p>
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
            {loading ? "확인 중..." : "입장"}
          </button>
        </div>
      </div>
    );
  }

  // ── 관리자 콘텐츠 ────────────────────────────────────────────────────────
  const activeGames = allGames.filter((g) => g.status === "active");
  const pendingAiGames = allGames.filter(
    (g) =>
      g.status === "active" &&
      !String(g.ai_briefing ?? "").trim() &&
      String(g.ai_approved ?? "").toLowerCase() !== "true"
  );

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-10">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          🔧 관리자 패널
        </h1>
        <p className="text-sm text-text-muted mt-1">
          전체 게임 현황 관리 및 시스템 설정
        </p>
      </div>

      {/* 전체 게임 현황 */}
      <section className="mb-10">
        <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-accent-blue rounded-full" />
          전체 게임 현황
          <span className="text-xs font-normal text-text-muted">({allGames.length}개)</span>
        </h2>

        {allGames.length === 0 ? (
          <div className="text-center py-16 text-text-muted border border-dashed border-border-default rounded-xl">
            <p className="text-3xl mb-3">🎮</p>
            <p>등록된 게임이 없습니다.</p>
          </div>
        ) : (
          <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-bg-secondary">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">게임</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">상태</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">AI 승인</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">수집 대상 / Steam 총계</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">마지막 분석</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted">액션</th>
                </tr>
              </thead>
              <tbody>
                {allGames.map((game, i) => {
                  const appid = String(game.appid);
                  const isArchived = game.status === "archived";
                  const isActive = game.status === "active";
                  const isApproved = String(game.ai_approved ?? "").toLowerCase() === "true";
                  const needsApproval =
                    isActive && !String(game.ai_briefing ?? "").trim() && !isApproved;

                  return (
                    <tr
                      key={appid}
                      className={`border-b border-border-default last:border-b-0 transition-colors ${
                        isArchived ? "opacity-60" : "hover:bg-bg-secondary/50"
                      } ${i % 2 === 0 ? "" : "bg-bg-secondary/20"}`}
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
                          <p className="text-xs text-text-muted truncate max-w-[200px]">{game.name}</p>
                        )}
                        <p className="text-xs text-text-muted">AppID {appid}</p>
                      </td>

                      {/* 상태 */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                            STATUS_COLORS[game.status]
                          }`}
                        >
                          {STATUS_LABELS[game.status]}
                        </span>
                      </td>

                      {/* AI 승인 토글 */}
                      <td className="px-4 py-3">
                        {isActive ? (
                          isApproved ? (
                            <button
                              onClick={() => handleUnapproveGame(appid)}
                              disabled={unapprovingIds.has(appid)}
                              title="클릭하면 AI 분석 승인이 취소됩니다. 이후 analyze.yml이 이 게임을 건너뜁니다."
                              className="text-xs text-accent-green hover:text-accent-red hover:line-through transition-colors disabled:opacity-40 cursor-pointer"
                            >
                              {unapprovingIds.has(appid) ? "취소 중..." : "✅ 승인됨"}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleApproveGame(appid)}
                              disabled={approvingIds.has(appid)}
                              title="클릭하면 AI 분석을 승인하고 즉시 분석 워크플로우가 트리거됩니다."
                              className="text-xs text-accent-orange hover:text-accent-green transition-colors disabled:opacity-40 cursor-pointer"
                            >
                              {approvingIds.has(appid) ? "승인 중..." : "⏳ 미승인"}
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </td>

                      {/* Steam API 수집 대상 / 스토어 총계 */}
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        <span title="Steam API 기준 수집 대상 리뷰 수 / Steam 스토어 표시 총 리뷰 수">
                          {Number(game.total_reviews_count ?? 0).toLocaleString()}
                          <span className="text-text-muted"> / {Number(game.totalReviews ?? 0).toLocaleString()}건</span>
                        </span>
                      </td>

                      {/* 마지막 분석 */}
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {game.ai_briefing_date || "—"}
                      </td>

                      {/* 액션 버튼 */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {/* AI 분석 승인 */}
                          {needsApproval && (
                            <button
                              onClick={() => handleApproveGame(appid)}
                              disabled={approvingIds.has(appid)}
                              className="px-2.5 py-1 text-xs bg-accent-orange/10 border border-accent-orange/40 text-accent-orange rounded hover:bg-accent-orange/20 transition-colors disabled:opacity-40"
                            >
                              {approvingIds.has(appid) ? "승인 중..." : "✅ AI 승인"}
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
                              {collectingMonthIds.has(appid) ? "요청 중..." : "📅 이번 달"}
                            </button>
                          )}

                          {/* AI 재분석 */}
                          {isActive && isApproved && (
                            <button
                              onClick={() => handleReanalyze(appid)}
                              disabled={reanalyzingIds.has(appid)}
                              title="최신 뉴스·패치를 재수집하고 전체 기간 AI 분석을 다시 실행합니다."
                              className="px-2.5 py-1 text-xs bg-bg-secondary border border-border-default text-text-secondary rounded hover:border-accent-blue/40 hover:text-accent-blue transition-colors disabled:opacity-40"
                            >
                              {reanalyzingIds.has(appid) ? "요청 중..." : "🔄 재분석"}
                            </button>
                          )}

                          {/* 소프트 삭제 / 복원 */}
                          {isArchived ? (
                            <button
                              onClick={() => handleRestore(appid)}
                              disabled={restoringIds.has(appid)}
                              className="px-2.5 py-1 text-xs bg-accent-green/10 border border-accent-green/30 text-accent-green rounded hover:bg-accent-green/20 transition-colors disabled:opacity-40"
                            >
                              {restoringIds.has(appid) ? "복원 중..." : "↩️ 복원"}
                            </button>
                          ) : (
                            confirmDeleteId === appid ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleDelete(appid)}
                                  disabled={deletingIds.has(appid)}
                                  className="px-2.5 py-1 text-xs bg-accent-red/20 border border-accent-red/40 text-accent-red rounded disabled:opacity-40"
                                >
                                  {deletingIds.has(appid) ? "삭제 중..." : "확인"}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2.5 py-1 text-xs bg-bg-secondary text-text-muted rounded hover:bg-bg-hover"
                                >
                                  취소
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(appid)}
                                className="px-2.5 py-1 text-xs bg-bg-secondary border border-border-default text-text-muted rounded hover:border-accent-red/30 hover:text-accent-red transition-colors"
                              >
                                🗑️ 숨기기
                              </button>
                            )
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
            ⚠️ AI 분석 미승인 게임 {pendingAiGames.length}개 — AI 승인 셀을 클릭해 게임별로 ON/OFF 설정하세요.
          </p>
        )}
      </section>

      {/* 시스템 도구 */}
      <section>
        <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-accent-orange rounded-full" />
          시스템 도구
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* UI 텍스트 동기화 */}
          <div className="bg-bg-card border border-border-default rounded-xl p-6 flex flex-col items-center text-center gap-4">
            <p className="text-3xl">📝</p>
            <div>
              <p className="font-semibold text-text-primary text-sm mb-0.5">UI 텍스트 동기화</p>
              <p className="text-xs text-text-muted leading-relaxed">
                코드에 새로 추가된 UI 문구 키를 Google Sheets에 반영합니다.
                기존 커스텀 번역은 그대로 유지됩니다.<br />
                <span className="text-text-secondary mt-1 block">새 UI 문구나 언어 추가 후 실행하세요.</span>
              </p>
            </div>
            <button
              onClick={() => setShowSyncModal(true)}
              disabled={syncing}
              className="w-full py-2 text-sm border border-border-default rounded-lg text-text-secondary hover:border-accent-blue/50 hover:text-accent-blue transition-colors disabled:opacity-40"
            >
              {syncing ? "처리 중..." : "동기화 실행"}
            </button>
          </div>

          {/* 미분석 AI 분석 */}
          <div className="bg-bg-card border border-border-default rounded-xl p-6 flex flex-col items-center text-center gap-4">
            <p className="text-3xl">⚡</p>
            <div>
              <p className="font-semibold text-text-primary text-sm mb-0.5">미분석 이벤트 AI 분석</p>
              <p className="text-xs text-text-muted leading-relaxed">
                이벤트 수집은 완료됐지만 AI 분석이 아직 실행되지 않은 구간만 선별해
                전체 게임을 대상으로 일괄 분석합니다.<br />
                <span className="text-text-secondary mt-1 block">뉴스 재수집 없이 분석만 실행됩니다.</span>
              </p>
            </div>
            <button
              onClick={handleAnalyzePending}
              disabled={analyzingPending}
              className="w-full py-2 text-sm border border-accent-blue/40 rounded-lg text-accent-blue hover:bg-accent-blue/10 transition-colors disabled:opacity-40"
            >
              {analyzingPending ? "요청 중..." : "분석 시작"}
            </button>
          </div>

          {/* 수집 재시작 */}
          <div className="bg-bg-card border border-border-default rounded-xl p-6 flex flex-col items-center text-center gap-4">
            <p className="text-3xl">🔄</p>
            <div>
              <p className="font-semibold text-text-primary text-sm mb-0.5">수집 재시작</p>
              <p className="text-xs text-text-muted leading-relaxed">
                GitHub Actions 수집 워크플로우를 수동으로 재트리거합니다.
                수집 대기열에 게임이 있는데 Action이 오류로 멈춘 경우 사용하세요.<br />
              </p>
            </div>
            <button
              onClick={() => setShowRetriggerConfirm(true)}
              disabled={retriggering}
              className="w-full py-2 text-sm border border-border-default rounded-lg text-text-secondary hover:border-accent-orange/50 hover:text-accent-orange transition-colors disabled:opacity-40"
            >
              {retriggering ? "재시작 중..." : "수집 재시작"}
            </button>
          </div>

        </div>
      </section>

      {/* UI 텍스트 동기화 모달 */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-card border border-border-default rounded-xl p-6 w-84 max-w-[calc(100vw-2rem)]">
            <p className="font-semibold mb-1">UI 텍스트 시트 관리</p>
            <p className="text-xs text-text-muted mb-5 leading-relaxed">
              <span className="font-medium text-text-secondary">동기화</span>: 누락 키만 추가, 기존 커스텀 값 보존<br />
              <span className="font-medium text-accent-orange">전체 재설정</span>: 실제 사용 키만 남기고 미사용 키 제거, 커스텀 값은 유지
            </p>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => handleSyncUiText(false)}
                disabled={syncing}
                className="flex-1 py-2 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue rounded-lg text-sm disabled:opacity-40"
              >
                {syncing ? "처리 중..." : "동기화"}
              </button>
              <button
                onClick={() => handleSyncUiText(true)}
                disabled={syncing}
                className="flex-1 py-2 bg-accent-orange/20 border border-accent-orange/40 text-accent-orange rounded-lg text-sm disabled:opacity-40"
              >
                {syncing ? "처리 중..." : "전체 재설정"}
              </button>
            </div>
            <button
              onClick={() => setShowSyncModal(false)}
              className="w-full py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 수집 재시작 확인 모달 */}
      {showRetriggerConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-card border border-border-default rounded-xl p-6 w-80">
            <p className="font-semibold mb-1">수집 재시작</p>
            <p className="text-xs text-text-muted mb-5 leading-relaxed">
              수집에 실패한 대기열 게임들의 GitHub Action을 다시 트리거합니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRetriggerCollect}
                disabled={retriggering}
                className="flex-1 py-2 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue rounded-lg text-sm disabled:opacity-40"
              >
                재시작
              </button>
              <button
                onClick={() => setShowRetriggerConfirm(false)}
                className="flex-1 py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover"
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
