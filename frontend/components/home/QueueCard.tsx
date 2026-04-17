"use client";
import Image from "next/image";
import { useState } from "react";
import Toast, { useToast } from "@/components/shared/Toast";
import type { Game } from "@/types";

interface QueueCardProps {
  game: Game;
  onCancelled: () => void;
}

export default function QueueCard({ game, onCancelled }: QueueCardProps) {
  const total = Number(game.total_reviews_count) || 0;
  const collected = Number(game.collected_reviews_count) || 0;
  const pct = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0;
  const remaining = total - collected;
  const etaMin = remaining > 0 ? Math.round(remaining / 800) : 0;
  const etaStr = etaMin > 60
    ? `약 ${Math.round(etaMin / 60)}시간`
    : etaMin > 0
    ? `약 ${etaMin}분`
    : "잠시 후 완료";

  const [showPwModal, setShowPwModal] = useState(false);
  const [pw, setPw] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const { toast, show, clear } = useToast();

  async function handleCancel() {
    setCancelling(true);
    const res = await fetch("/api/admin/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appid: game.appid, password: pw }),
    });
    const data = await res.json();
    setCancelling(false);
    setShowPwModal(false);
    setPw("");
    if (data.ok) {
      show("등록이 취소되었습니다.", "success");
      setTimeout(onCancelled, 1000);
    } else {
      show(data.error ?? "오류가 발생했습니다.", "error");
    }
  }

  return (
    <div className="bg-bg-card border border-border-default rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        {game.thumbnail && (
          <Image src={game.thumbnail} alt={game.name} width={80} height={30} className="rounded object-cover" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{game.name_kr || game.name}</p>
          <p className="text-xs text-text-muted mt-0.5">수집 중...</p>
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="mt-2">
        <div className="flex justify-between text-xs text-text-secondary mb-1">
          <span>{collected.toLocaleString()} / {total.toLocaleString()}건</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-blue rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-text-muted mt-1.5">
          예상 잔여 시간: {etaStr}
          <span className="ml-1 text-[10px] opacity-60">(Steam API 상태에 따라 변동)</span>
        </p>
      </div>

      <button
        onClick={() => setShowPwModal(true)}
        className="mt-3 text-xs text-accent-red/70 hover:text-accent-red transition-colors"
      >
        등록 취소
      </button>

      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-card border border-border-default rounded-xl p-6 w-80">
            <p className="font-semibold mb-3">관리자 비밀번호 확인</p>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="비밀번호 입력"
              className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue mb-3"
              onKeyDown={(e) => e.key === "Enter" && handleCancel()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={cancelling || !pw}
                className="flex-1 py-2 bg-accent-red/20 border border-accent-red/40 text-accent-red rounded-lg text-sm disabled:opacity-40"
              >
                {cancelling ? "처리 중..." : "등록 취소 확인"}
              </button>
              <button
                onClick={() => { setShowPwModal(false); setPw(""); }}
                className="flex-1 py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}
