"use client";
import { useState, ReactNode } from "react";
import SearchModal from "./SearchModal";
import { useUiText } from "@/contexts/UiTextContext";

interface Props {
  children: ReactNode;
}

export default function FloatingRightPanel({ children }: Props) {
  const [open, setOpen] = useState(false);
  const { t } = useUiText();

  return (
    <>
      {/* 데스크탑 전용 우측 플로팅 패널 */}
      <div className="hidden lg:flex fixed right-4 top-20 z-30 w-72 xl:w-80 flex-col gap-2 max-h-[calc(100vh-5.5rem)]">

        {/* 가로형 게임 등록하기 버튼 */}
        <div className="relative flex-shrink-0">
          {/* 핑 효과 */}
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 pointer-events-none z-10">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent-blue opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-blue" />
          </span>
          <button
            onClick={() => setOpen(true)}
            title={t("FLOATING_NAV_TITLE")}
            className="group w-full flex items-center justify-center gap-2
              bg-bg-card border border-border-default
              rounded-xl px-4 py-3
              shadow-[0_4px_20px_rgba(79,135,255,0.15)]
              hover:bg-accent-blue hover:border-accent-blue
              hover:shadow-[0_4px_28px_rgba(79,135,255,0.5)]
              transition-all duration-200"
          >
            <svg
              className="w-4 h-4 text-text-secondary group-hover:text-white transition-colors flex-shrink-0"
              fill="none" stroke="currentColor" strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-semibold text-text-primary group-hover:text-white transition-colors">
              {t("FLOATING_NAV_BTN")}
            </span>
          </button>
        </div>

        {/* 인사이트 패널 (스크롤 가능) */}
        <div className="flex-1 overflow-y-auto min-h-0 rounded-2xl
          [&::-webkit-scrollbar]:w-1
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-border-default
          [&::-webkit-scrollbar-thumb]:rounded-full">
          {children}
        </div>

      </div>

      {open && <SearchModal onClose={() => setOpen(false)} />}
    </>
  );
}
