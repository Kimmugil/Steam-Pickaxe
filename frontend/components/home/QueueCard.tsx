"use client";
import Image from "next/image";
import { useState } from "react";
import Toast, { useToast } from "@/components/shared/Toast";
import { useUiText } from "@/contexts/UiTextContext";
import type { Game } from "@/types";

interface QueueCardProps {
  game: Game;
  onCancelled: () => void;
}

// ── 풀 고갈 오류 카드 ────────────────────────────────────────────────────────
function PoolEmptyCard({
  game,
  onRetried,
}: {
  game: Game;
  onRetried: () => void;
}) {
  const { t } = useUiText();
  const [showPwModal, setShowPwModal] = useState(false);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast, show, clear } = useToast();

  async function handleRetry() {
    setLoading(true);
    const res = await fetch("/api/admin/retry-pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appid: game.appid, password: pw }),
    });
    const data = await res.json();
    setLoading(false);
    setShowPwModal(false);
    setPw("");

    if (data.ok) {
      show(t("POOL_EMPTY_RETRY_SUCCESS"), "success");
      setTimeout(onRetried, 1500);
    } else {
      show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
    }
  }

  return (
    <div className="bg-bg-card border border-accent-red/40 rounded-xl overflow-hidden">
      {/* 썸네일 */}
      {game.thumbnail && (
        <div className="relative w-full aspect-[460/215] bg-bg-secondary">
          <Image
            src={game.thumbnail}
            alt={game.name}
            fill
            className="object-cover opacity-50"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          {/* 오류 뱃지 */}
          <span className="absolute top-2 left-2 text-[10px] bg-accent-red/90 text-white px-2 py-0.5 rounded font-medium">
            수집 오류
          </span>
        </div>
      )}

      <div className="p-4">
        <p className="font-semibold text-sm truncate text-text-primary">
          {game.name_kr || game.name}
        </p>

        {/* 오류 메시지 */}
        <div className="mt-3 p-3 bg-accent-red/10 border border-accent-red/30 rounded-lg">
          <p className="text-xs text-accent-red leading-relaxed">
            {t("POOL_EMPTY_MSG")}
          </p>
        </div>

        {/* 재시도 버튼 */}
        <button
          onClick={() => setShowPwModal(true)}
          className="mt-3 w-full py-2 text-xs bg-accent-blue/10 border border-accent-blue/30 text-accent-blue rounded-lg hover:bg-accent-blue/20 transition-colors"
        >
          {t("POOL_EMPTY_RETRY_BTN")}
        </button>
      </div>

      {/* 관리자 비밀번호 모달 */}
      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-card border border-border-default rounded-xl p-6 w-80">
            <p className="font-semibold mb-1">{t("ADMIN_PW_TITLE")}</p>
            <p className="text-xs text-text-muted mb-3">
              Sheet_Pool 탭에 새 시트를 추가한 후 진행하세요.
            </p>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder={t("ADMIN_PW_PLACEHOLDER")}
              className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue mb-3"
              onKeyDown={(e) => e.key === "Enter" && handleRetry()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleRetry}
                disabled={loading || !pw}
                className="flex-1 py-2 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue rounded-lg text-sm disabled:opacity-40"
              >
                {loading ? "처리 중..." : t("POOL_EMPTY_RETRY_BTN")}
              </button>
              <button
                onClick={() => { setShowPwModal(false); setPw(""); }}
                className="flex-1 py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover"
              >
                {t("ADMIN_CLOSE_BTN")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}

// ── 정상 수집 중 카드 ────────────────────────────────────────────────────────
export default function QueueCard({ game, onCancelled }: QueueCardProps) {
  const { t } = useUiText();

  // error_pool_empty 상태면 오류 카드 렌더링
  if (game.status === "error_pool_empty") {
    return <PoolEmptyCard game={game} onRetried={onCancelled} />;
  }

  const total = Number(game.total_reviews_count) || 0;
  const collected = Number(game.collected_reviews_count) || 0;
  const remaining = total - collected;
  const etaMin = remaining > 0 ? Math.round(remaining / 800) : 0;
  const etaStr =
    etaMin > 60
      ? t("QUEUE_ETA_HOURS", { hours: Math.round(etaMin / 60) })
      : etaMin > 0
      ? t("QUEUE_ETA_MINS", { mins: etaMin })
      : t("QUEUE_ETA_SOON");

  // cursor가 *이 아닌데 game_sheet_id가 없으면 수집 실패로 인한 불일치 상태
  const isCursorStuck =
    game.last_cursor && game.last_cursor !== "*" && !game.game_sheet_id;

  const [showPwModal, setShowPwModal] = useState(false);
  const [modalMode, setModalMode] = useState<"cancel" | "reset">("cancel");
  const [pw, setPw] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const { toast, show, clear } = useToast();

  function openModal(mode: "cancel" | "reset") {
    setModalMode(mode);
    setPw("");
    setShowPwModal(true);
  }

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
      show(t("QUEUE_CANCEL_SUCCESS"), "success");
      setTimeout(onCancelled, 1000);
    } else {
      show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
    }
  }

  async function handleResetCursor() {
    setCancelling(true);
    const res = await fetch("/api/admin/reset-cursor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appid: game.appid, password: pw }),
    });
    const data = await res.json();
    setCancelling(false);
    setShowPwModal(false);
    setPw("");
    if (data.ok) {
      show("커서 초기화 완료. 다음 수집 시 처음부터 재시작됩니다.", "success");
      setTimeout(onCancelled, 1200);
    } else {
      show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
    }
  }

  return (
    <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
      {/* 썸네일 — 전체 너비, Steam 공식 460:215 비율 */}
      {game.thumbnail && (
        <div className="relative w-full aspect-[460/215] bg-bg-secondary">
          <Image
            src={game.thumbnail}
            alt={game.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <span className="absolute top-2 left-2 text-[10px] bg-accent-blue/90 text-white px-2 py-0.5 rounded font-medium animate-pulse">
            {t("QUEUE_COLLECTING")}
          </span>
        </div>
      )}

      <div className="p-4">
        <p className="font-semibold text-sm truncate text-text-primary">
          {game.name_kr || game.name}
        </p>
        {game.name_kr && game.name_kr !== game.name && (
          <p className="text-xs text-text-muted truncate mt-0.5">{game.name}</p>
        )}

        {/* 수집 현황 */}
        <div className="mt-3 space-y-1">
          {total > 0 && (
            <p className="text-xs text-text-secondary">
              리뷰 {collected.toLocaleString()} / {total.toLocaleString()}건
            </p>
          )}
          <p className="text-xs text-text-muted">
            {t("QUEUE_ETA_LABEL")}: {etaStr}
            <span className="ml-1 text-[10px] opacity-60">{t("QUEUE_ETA_SUFFIX")}</span>
          </p>
        </div>

        {/* 수집 실패 경고 (cursor 불일치) */}
        {isCursorStuck && (
          <div className="mt-2 p-2 bg-accent-orange/10 border border-accent-orange/30 rounded-lg">
            <p className="text-[11px] text-accent-orange leading-relaxed">
              수집 Action이 중단됐습니다. cursor 초기화 후 재수집이 필요합니다.
            </p>
            <button
              onClick={() => openModal("reset")}
              className="mt-1.5 text-[11px] text-accent-orange border border-accent-orange/40 rounded px-2 py-0.5 hover:bg-accent-orange/10 transition-colors"
            >
              cursor 초기화 (처음부터 재수집)
            </button>
          </div>
        )}

        <button
          onClick={() => openModal("cancel")}
          className="mt-3 text-xs text-accent-red/70 hover:text-accent-red transition-colors"
        >
          {t("QUEUE_CANCEL_BTN")}
        </button>
      </div>

      {/* 관리자 비밀번호 모달 */}
      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-card border border-border-default rounded-xl p-6 w-80">
            <p className="font-semibold mb-1">{t("ADMIN_PW_TITLE")}</p>
            {modalMode === "reset" && (
              <p className="text-xs text-text-muted mb-3">
                cursor를 *로 초기화하고 처음부터 다시 수집합니다.
              </p>
            )}
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder={t("ADMIN_PW_PLACEHOLDER")}
              className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue mb-3 mt-2"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (modalMode === "reset") handleResetCursor();
                  else handleCancel();
                }
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={modalMode === "reset" ? handleResetCursor : handleCancel}
                disabled={cancelling || !pw}
                className={`flex-1 py-2 rounded-lg text-sm disabled:opacity-40 border ${
                  modalMode === "reset"
                    ? "bg-accent-orange/20 border-accent-orange/40 text-accent-orange"
                    : "bg-accent-red/20 border-accent-red/40 text-accent-red"
                }`}
              >
                {cancelling ? "처리 중..." : modalMode === "reset" ? "cursor 초기화" : t("QUEUE_CANCEL_CONFIRM_BTN")}
              </button>
              <button
                onClick={() => { setShowPwModal(false); setPw(""); }}
                className="flex-1 py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover"
              >
                {t("ADMIN_CLOSE_BTN")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </div>
  );
}
