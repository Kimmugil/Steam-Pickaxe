"use client";
import { useState, useRef, useEffect } from "react";
import type { Game, TimelineRow } from "@/types";
import { useUiText } from "@/contexts/UiTextContext";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface ChatBotProps {
  game: Game;
  timelineRows: TimelineRow[];
}

export default function ChatBot({ game, timelineRows }: ChatBotProps) {
  const { t } = useUiText();
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
      body: JSON.stringify({ appid: game.appid, question: userText, history: messages.slice(-10) }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.limitReached) {
      setLimitReached(true);
      setMessages((prev) => [...prev, { role: "assistant", text: t("CHATBOT_LIMIT_MSG") }]);
      return;
    }
    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: data.answer || t("CHATBOT_ERROR_MSG") },
    ]);
  }

  const tooltipText = t("CHATBOT_TOOLTIP", { gameName: game.name_kr || game.name });
  const suggestedQuestions = [t("CHATBOT_Q1"), t("CHATBOT_Q2"), t("CHATBOT_Q3")];

  return (
    <>
      {/* 툴팁 말풍선 */}
      {!open && (
        <div className="fixed bottom-8 right-24 z-40 max-w-[220px] bg-bg-card border border-border-default rounded-xl shadow-lg px-3 py-2 pointer-events-none">
          <p className="text-xs text-text-secondary leading-relaxed">{tooltipText}</p>
          <div className="absolute right-[-7px] top-1/2 -translate-y-1/2 w-3 h-3 bg-bg-card border-r border-t border-border-default rotate-45" />
        </div>
      )}

      {/* FAB */}
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
          <div className="px-4 py-3 border-b border-border-default bg-bg-secondary flex items-center gap-2">
            <span className="w-2 h-2 bg-accent-green rounded-full animate-pulse" />
            <p className="text-sm font-semibold text-text-primary">
              {game.name_kr || game.name} {t("CHATBOT_HEADER_SUFFIX")}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-10">
                <p className="text-text-muted text-sm">{t("CHATBOT_EMPTY_MSG")}</p>
                <div className="mt-4 space-y-2">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
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
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-accent-blue text-white rounded-br-sm"
                    : "bg-bg-secondary border border-border-default text-text-secondary rounded-bl-sm"
                }`}>
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

          <div className="px-4 py-3 border-t border-border-default">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder={limitReached ? t("CHATBOT_INPUT_PLACEHOLDER_LIMIT") : t("CHATBOT_INPUT_PLACEHOLDER")}
                disabled={limitReached || loading}
                className="flex-1 bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue disabled:opacity-40"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading || limitReached}
                className="px-3 py-2 bg-accent-blue rounded-lg text-white text-sm disabled:opacity-40 hover:bg-blue-500 transition-colors"
              >
                {t("CHATBOT_SEND_BTN")}
              </button>
            </div>
            <p className="text-[10px] text-text-muted mt-1.5 text-right">
              {t("CHATBOT_DISCLAIMER")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
