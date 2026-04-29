"use client";
import { useState } from "react";
import Toast, { useToast } from "@/components/shared/Toast";
import { useUiText } from "@/contexts/UiTextContext";

/**
 * 수집 대기열 재시작 버튼 (관리자 전용)
 * collect.yml 워크플로우를 수동 트리거합니다.
 * 수집 Action이 실패로 중단된 게임들을 재개할 때 사용합니다.
 */
export default function QueueRetriggerButton() {
  const { t } = useUiText();
  const [showModal, setShowModal] = useState(false);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast, show, clear } = useToast();

  async function handleRetrigger() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/retrigger-collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (data.ok) {
        show(t("ADMIN_TOAST_RETRIGGER"), "success");
        setShowModal(false);
        setPw("");
      } else {
        show(data.error ?? t("ADMIN_GENERIC_ERROR"), "error");
      }
    } catch {
      show(t("SERVER_CONNECT_ERROR"), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-xs text-text-muted hover:text-accent-blue transition-colors px-2 py-0.5 border border-border-default rounded hover:border-accent-blue/50"
        title={t("ADMIN_TOOL_COLLECT_DESC")}
      >
        {t("ADMIN_TOOL_COLLECT_BTN")}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-card border border-border-default rounded-xl p-6 w-80">
            <p className="font-semibold mb-1">{t("ADMIN_RETRIGGER_MODAL_TITLE")}</p>
            <p className="text-xs text-text-muted mb-4">{t("ADMIN_RETRIGGER_MODAL_DESC")}</p>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder={t("ADMIN_PW_PLACEHOLDER")}
              className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue mb-3"
              onKeyDown={(e) => e.key === "Enter" && !loading && pw && handleRetrigger()}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleRetrigger}
                disabled={loading || !pw}
                className="flex-1 py-2 bg-accent-blue/20 border border-accent-blue/40 text-accent-blue rounded-lg text-sm disabled:opacity-40"
              >
                {loading ? t("PROCESSING") : t("ADMIN_RETRIGGER_BTN")}
              </button>
              <button
                onClick={() => { setShowModal(false); setPw(""); }}
                className="flex-1 py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover"
              >
                {t("ADMIN_BTN_CANCEL")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </>
  );
}
