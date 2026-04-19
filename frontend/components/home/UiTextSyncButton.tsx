"use client";
import { useState } from "react";
import Toast, { useToast } from "@/components/shared/Toast";

/**
 * UI 텍스트 시트 동기화 버튼 (관리자 전용)
 *
 * sync  — 누락 키만 추가, 기존 커스텀 값 보존
 * reset — 탭 전체 재작성: FALLBACK 키만 남기고 미사용 키 제거, 커스텀 값 보존
 */
export default function UiTextSyncButton() {
  const [showModal, setShowModal] = useState(false);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast, show, clear } = useToast();

  async function handleAction(reset: boolean) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sync-ui-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, reset }),
      });
      const data = await res.json();
      if (data.ok) {
        if (reset) {
          show(
            `ui_text 재설정 완료 — 유지 ${data.kept}건 / 추가 ${data.added}건 / 제거 ${data.removed}건`,
            "success"
          );
        } else {
          show(
            `ui_text 동기화 완료 — 추가 ${data.added}건 / 기존 유지 ${data.skipped}건`,
            "success"
          );
        }
        setShowModal(false);
        setPw("");
      } else {
        show(data.error ?? "오류가 발생했습니다.", "error");
      }
    } catch {
      show("요청 실패", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-xs text-text-muted hover:text-accent-blue transition-colors px-2 py-0.5 border border-border-default rounded hover:border-accent-blue/50"
        title="UI 텍스트 Sheets 탭 동기화 (관리자)"
      >
        UI 텍스트 동기화
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-card border border-border-default rounded-xl p-6 w-84 max-w-[calc(100vw-2rem)]">
            <p className="font-semibold mb-1">UI 텍스트 시트 관리</p>
            <p className="text-xs text-text-muted mb-4 leading-relaxed">
              <span className="font-medium text-text-secondary">동기화</span>: 누락 키만 추가, 기존 커스텀 값 보존<br />
              <span className="font-medium text-accent-orange">재설정</span>: 탭 전체 재작성 — 실제 사용 키만 남기고 미사용 키 제거, 커스텀 값은 유지
            </p>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="관리자 비밀번호"
              className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue mb-3"
              onKeyDown={(e) => e.key === "Enter" && !loading && pw && handleAction(false)}
              autoFocus
            />
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => handleAction(false)}
                disabled={loading || !pw}
                className="flex-1 py-2 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue rounded-lg text-sm disabled:opacity-40"
              >
                {loading ? "처리 중..." : "동기화"}
              </button>
              <button
                onClick={() => handleAction(true)}
                disabled={loading || !pw}
                className="flex-1 py-2 bg-accent-orange/20 border border-accent-orange/40 text-accent-orange rounded-lg text-sm disabled:opacity-40"
              >
                {loading ? "처리 중..." : "전체 재설정"}
              </button>
            </div>
            <button
              onClick={() => { setShowModal(false); setPw(""); }}
              className="w-full py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </>
  );
}
