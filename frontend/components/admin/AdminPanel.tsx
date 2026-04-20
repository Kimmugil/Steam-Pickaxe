"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import QueueCard from "@/components/home/QueueCard";
import Toast, { useToast } from "@/components/shared/Toast";
import type { Game } from "@/types";

const SESSION_KEY = "steam_admin_pw";

export default function AdminPanel({
  collectingGames,
  pendingAiGames,
}: {
  collectingGames: Game[];
  pendingAiGames: Game[];
}) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast, show, clear } = useToast();

  // 도구 카드별 로딩 상태
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [analyzingPending, setAnalyzingPending] = useState(false);
  const [showRetriggerConfirm, setShowRetriggerConfirm] = useState(false);
  const [retriggering, setRetriggering] = useState(false);

  // AI 분석 승인 로딩 상태 (appid별)
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());

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

  // ── UI 텍스트 동기화 ──────────────────────────────────────────────────────
  async function handleSyncUiText(reset: boolean) {
    const savedPw = sessionStorage.getItem(SESSION_KEY);
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
    const savedPw = sessionStorage.getItem(SESSION_KEY);
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

  // ── AI 분석 승인 ─────────────────────────────────────────────────────────
  async function handleApproveGame(appid: string) {
    const savedPw = sessionStorage.getItem(SESSION_KEY);
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
        show(`AI 분석 승인 완료. 곧 분석이 시작됩니다.`, "success");
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

  // ── 수집 재시작 ───────────────────────────────────────────────────────────
  async function handleRetriggerCollect() {
    const savedPw = sessionStorage.getItem(SESSION_KEY);
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
  return (
    <div className="max-w-screen-xl mx-auto px-6 py-10">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          🔧 관리자 패널
        </h1>
        <p className="text-sm text-text-muted mt-1">수집 대기열 관리 및 시스템 설정</p>
      </div>

      {/* 수집 대기열 */}
      <section className="mb-10">
        <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-accent-blue rounded-full animate-pulse" />
          수집 대기열
          <span className="text-xs font-normal text-text-muted">({collectingGames.length}개)</span>
        </h2>
        {collectingGames.length === 0 ? (
          <div className="text-center py-16 text-text-muted border border-dashed border-border-default rounded-xl">
            <p className="text-3xl mb-3">✅</p>
            <p>현재 수집 중인 게임이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collectingGames.map((game) => (
              <QueueCard
                key={String(game.appid)}
                game={game}
                onCancelled={() => router.refresh()}
              />
            ))}
          </div>
        )}
      </section>

      {/* AI 분석 승인 대기 */}
      {pendingAiGames.length > 0 && (
        <section className="mb-10">
          <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-accent-orange rounded-full" />
            AI 분석 승인 대기
            <span className="text-xs font-normal text-text-muted">({pendingAiGames.length}개)</span>
          </h2>
          <p className="text-xs text-text-muted mb-4">
            데이터 수집이 완료되어 페이지가 발행됐지만, 아직 AI 분석이 실행되지 않은 게임입니다.
            승인 시 즉시 AI 분석이 시작됩니다 (비용 발생).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingAiGames.map((game) => {
              const eventCount = Number(game.event_count ?? 0);
              const reviewCount = Number(game.collected_reviews_count ?? 0);
              const isApproving = approvingIds.has(String(game.appid));
              return (
                <div
                  key={String(game.appid)}
                  className="bg-bg-card border border-accent-orange/20 rounded-xl p-4 flex flex-col gap-3"
                >
                  <div>
                    <p className="font-semibold text-text-primary text-sm truncate">
                      {game.name_kr || game.name}
                    </p>
                    {game.name_kr && game.name_kr !== game.name && (
                      <p className="text-xs text-text-muted truncate">{game.name}</p>
                    )}
                  </div>
                  <div className="text-xs text-text-muted space-y-0.5">
                    <p>리뷰 {reviewCount.toLocaleString()}건 수집 완료</p>
                    {eventCount > 0 && <p>이벤트 {eventCount}건</p>}
                    <p className="text-accent-orange">
                      예상 비용: ~${((eventCount || 1) * 0.07).toFixed(2)} (이벤트 수 기준)
                    </p>
                  </div>
                  <button
                    onClick={() => handleApproveGame(String(game.appid))}
                    disabled={isApproving}
                    className="w-full py-2 text-sm bg-accent-orange/10 border border-accent-orange/40 text-accent-orange rounded-lg hover:bg-accent-orange/20 transition-colors disabled:opacity-40"
                  >
                    {isApproving ? "승인 중..." : "✅ AI 분석 승인"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 시스템 도구 */}
      <section>
        <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-accent-orange rounded-full" />
          시스템 도구
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* 카드 1: UI 텍스트 동기화 */}
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

          {/* 카드 2: 미분석 AI 분석 */}
          <div className="bg-bg-card border border-border-default rounded-xl p-6 flex flex-col items-center text-center gap-4">
            <p className="text-3xl">⚡</p>
            <div>
              <p className="font-semibold text-text-primary text-sm mb-0.5">미분석 이벤트 AI 분석</p>
              <p className="text-xs text-text-muted leading-relaxed">
                이벤트 수집은 완료됐지만 AI 분석이 아직 실행되지 않은 구간만 선별해
                전체 게임을 대상으로 일괄 분석합니다.<br />
                <span className="text-text-secondary mt-1 block">뉴스 재수집 없이 분석만 실행됩니다. 새 게임·이벤트 등록 후 분석이 안 된 경우 사용하세요.</span>
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

          {/* 카드 3: 수집 재시작 */}
          <div className="bg-bg-card border border-border-default rounded-xl p-6 flex flex-col items-center text-center gap-4">
            <p className="text-3xl">🔄</p>
            <div>
              <p className="font-semibold text-text-primary text-sm mb-0.5">수집 재시작</p>
              <p className="text-xs text-text-muted leading-relaxed">
                GitHub Actions 수집 워크플로우를 수동으로 재트리거합니다.
                게임을 취소·재등록하지 않아도 이어서 수집이 재개됩니다.<br />
                <span className="text-text-secondary mt-1 block">수집 대기열에 게임이 있는데 수집 Action이 오류로 멈춘 경우 사용하세요.</span>
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
              취소 후 재등록 없이 이어서 수집이 시작됩니다.
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
