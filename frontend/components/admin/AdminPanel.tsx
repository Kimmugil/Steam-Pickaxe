"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import QueueCard from "@/components/home/QueueCard";
import QueueRetriggerButton from "@/components/home/QueueRetriggerButton";
import UiTextSyncButton from "@/components/home/UiTextSyncButton";
import Toast, { useToast } from "@/components/shared/Toast";
import type { Game } from "@/types";

const SESSION_KEY = "steam_admin_pw";

export default function AdminPanel({ collectingGames }: { collectingGames: Game[] }) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast, show, clear } = useToast();

  // 세션에 저장된 비밀번호로 자동 인증 시도
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

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthed(false);
    setPw("");
  }

  // ── 비밀번호 게이트 ────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-20">
        <div className="bg-bg-card border border-border-default rounded-xl p-8 text-center">
          <p className="text-2xl mb-2">🔒</p>
          <h1 className="text-lg font-semibold text-text-primary mb-1">관계자외 출입금지</h1>
          <p className="text-xs text-text-muted mb-6">관리자 비밀번호를 입력하세요.</p>
          {error && (
            <p className="text-xs text-accent-red mb-3">{error}</p>
          )}
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

  // ── 관리자 콘텐츠 ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-screen-xl mx-auto px-6 py-10">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            🔧 관리자 패널
          </h1>
          <p className="text-sm text-text-muted mt-1">수집 대기열 관리 및 시스템 설정</p>
        </div>
        <div className="flex items-center gap-3">
          <UiTextSyncButton />
          <QueueRetriggerButton />
          <button
            onClick={handleLogout}
            className="text-xs text-text-muted hover:text-accent-red transition-colors px-2 py-0.5 border border-border-default rounded hover:border-accent-red/50"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 수집 대기열 */}
      <section>
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

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}
