"use client";
import { useState } from "react";
import Toast, { useToast } from "@/components/shared/Toast";

/**
 * 수집 대기열 재시작 버튼 (관리자 전용)
 * collect.yml 워크플로우를 수동 트리거합니다.
 * 수집 Action이 실패로 중단된 게임들을 재개할 때 사용합니다.
 */
export default function QueueRetriggerButton() {
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
        show("수집 워크플로우를 재시작했습니다. 수분 내 진행됩니다.", "success");
        setShowModal(false);
        setPw("");
      } else {
        show(data.error ?? "오류가 발생했습니다.", "error");
      }
    } catch {
      show("서버 연결 오류", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-xs text-text-muted hover:text-accent-blue transition-colors px-2 py-0.5 border border-border-default rounded hover:border-accent-blue/50"
        title={"GitHub Actions 수집 워크플로우를 수동으로 재트리거합니다. 수집 대기열에 게임이 있는데 Action이 오류로 멈춘 경우 사용하세요."}
      >
        {"수집 재시작"}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-card border border-border-default rounded-xl p-6 w-80">
            <p className="font-semibold mb-1">{"수집 재시작"}</p>
            <p className="text-xs text-text-muted mb-4">{"수집에 실패한 대기열 게임들의 GitHub Action을 다시 트리거합니다."}</p>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder={"비밀번호 입력"}
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
                {loading ? "처리 중..." : "재시작"}
              </button>
              <button
                onClick={() => { setShowModal(false); setPw(""); }}
                className="flex-1 py-2 bg-bg-secondary text-text-secondary rounded-lg text-sm hover:bg-bg-hover"
              >
                {"취소"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
    </>
  );
}
