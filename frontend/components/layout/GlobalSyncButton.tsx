"use client";
import { useState, useRef, useEffect } from "react";

type Phase = "idle" | "prompt" | "loading" | "ok" | "error";

export default function GlobalSyncButton() {
  const [phase, setPhase]   = useState<Phase>("idle");
  const [msg,   setMsg]     = useState("");
  const inputRef            = useRef<HTMLInputElement>(null);

  // 성공/실패 메시지 자동 닫기
  useEffect(() => {
    if (phase === "ok" || phase === "error") {
      const t = setTimeout(() => setPhase("idle"), 3000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // 팝오버 열리면 인풋 포커스
  useEffect(() => {
    if (phase === "prompt") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [phase]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const pw = inputRef.current?.value ?? "";
    if (!pw) return;
    setPhase("loading");
    try {
      const res  = await fetch("/api/admin/sync-ui-text", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "오류 발생");
        setPhase("error");
      } else {
        setMsg(`✅ +${data.added ?? 0}건 추가 / ${data.skipped ?? 0}건 유지`);
        setPhase("ok");
      }
    } catch {
      setMsg("서버 연결 오류");
      setPhase("error");
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">

      {/* 비밀번호 팝오버 */}
      {phase === "prompt" && (
        <form
          onSubmit={handleSubmit}
          className="bg-bg-card border border-border-default rounded-xl shadow-2xl px-3 py-3 flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="password"
            placeholder="관리자 비밀번호"
            className="bg-bg-secondary text-text-primary text-xs rounded-lg px-2.5 py-1.5 border border-border-default outline-none focus:border-accent-blue w-36"
            onKeyDown={(e) => e.key === "Escape" && setPhase("idle")}
          />
          <button
            type="submit"
            className="text-xs bg-accent-blue text-white px-2.5 py-1.5 rounded-lg hover:bg-accent-blue/80 transition-colors"
          >
            동기화
          </button>
          <button
            type="button"
            onClick={() => setPhase("idle")}
            className="text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            ✕
          </button>
        </form>
      )}

      {/* 결과 토스트 */}
      {(phase === "ok" || phase === "error") && (
        <div className={`text-xs px-3 py-2 rounded-xl border shadow-xl ${
          phase === "ok"
            ? "bg-accent-green/10 border-accent-green/30 text-accent-green"
            : "bg-accent-red/10 border-accent-red/30 text-accent-red"
        }`}>
          {msg}
        </div>
      )}

      {/* 메인 버튼 */}
      <button
        onClick={() => phase === "idle" ? setPhase("prompt") : setPhase("idle")}
        title="ui_text 즉시 동기화"
        className={`w-9 h-9 rounded-full border shadow-lg flex items-center justify-center transition-all duration-200 ${
          phase === "loading"
            ? "bg-accent-blue/20 border-accent-blue/40 text-accent-blue cursor-wait animate-spin"
            : phase === "ok"
            ? "bg-accent-green/20 border-accent-green/40 text-accent-green"
            : phase === "error"
            ? "bg-accent-red/20 border-accent-red/40 text-accent-red"
            : "bg-bg-card border-border-default text-text-muted hover:border-accent-blue hover:text-accent-blue hover:bg-accent-blue/10"
        }`}
      >
        {phase === "loading" ? (
          /* 로딩 스피너 */
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
          </svg>
        ) : (
          /* 동기화 아이콘 */
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

    </div>
  );
}
