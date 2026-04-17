"use client";
import { useState, useRef, useEffect } from "react";
import type { Game, TimelineRow } from "@/types";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface ChatBotProps {
  game: Game;
  timelineRows: TimelineRow[];
}

export default function ChatBot({ game, timelineRows }: ChatBotProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  async function handleSend() {
    if (!input.trim() || loading || limitReached) return;
    const userText = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setLoading(true);

    const res = await fetch("/api/chatbot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appid: game.appid,
        question: userText,
        history: messages.slice(-10),
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.limitReached) {
      setLimitReached(true);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "오늘 질문 한도에 도달했어요. 내일 다시 이용해 주세요." },
      ]);
      return;
    }
    if (data.answer) {
      setMessages((prev) => [...prev, { role: "assistant", text: data.answer }]);
    } else {
      setMessages((prev) => [...prev, { role: "assistant", text: "응답을 생성하지 못했습니다." }]);
    }
  }

  return (
    <>
      {/* FAB 버튼 */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-accent-blue shadow-lg shadow-accent-blue/30 flex items-center justify-center text-white text-2xl hover:bg-blue-500 transition-all hover:scale-110"
        title="AI 챗봇"
      >
        {open ? "✕" : "💬"}
      </button>

      {/* 챗봇 패널 */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-96 h-[520px] bg-bg-card border border-border-default rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* 헤더 */}
          <div className="px-4 py-3 border-b border-border-default bg-bg-secondary flex items-center gap-2">
            <span className="w-2 h-2 bg-accent-green rounded-full animate-pulse" />
            <p className="text-sm font-semibold text-text-primary">{game.name_kr || game.name} — AI 분석</p>
          </div>

          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-10">
                <p className="text-text-muted text-sm">이 게임에 대해 무엇이든 물어보세요.</p>
                <div className="mt-4 space-y-2">
                  {[
                    "최근 업데이트 후 유저 반응은?",
                    "어느 지역 플레이어가 가장 많아?",
                    "긍정률이 떨어진 이유는?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="block w-full text-left text-xs px-3 py-2 bg-bg-secondary border border-border-default rounded-lg text-text-secondary hover:border-accent-blue/40 hover:text-text-primary transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-accent-blue text-white rounded-br-sm"
                      : "bg-bg-secondary border border-border-default text-text-secondary rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-bg-secondary border border-border-default px-4 py-2 rounded-xl rounded-bl-sm">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 입력 */}
          <div className="px-4 py-3 border-t border-border-default">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder={limitReached ? "오늘 한도 도달" : "질문 입력..."}
                disabled={limitReached || loading}
                className="flex-1 bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue disabled:opacity-40"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading || limitReached}
                className="px-3 py-2 bg-accent-blue rounded-lg text-white text-sm disabled:opacity-40 hover:bg-blue-500 transition-colors"
              >
                전송
              </button>
            </div>
            <p className="text-[10px] text-text-muted mt-1.5 text-right">
              데이터에 기반한 현상 진단만 제공합니다
            </p>
          </div>
        </div>
      )}
    </>
  );
}
