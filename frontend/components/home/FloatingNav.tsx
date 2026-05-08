"use client";
import { useState } from "react";
import SearchModal from "./SearchModal";

export default function FloatingNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 모바일 전용 좌측 플로팅 탭 버튼 */}
      <div className="lg:hidden fixed left-0 top-1/2 -translate-y-1/2 z-40">
        <div className="relative">
        {/* 핑 효과 (눈길 끌기) */}
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 pointer-events-none z-10">
          <span className="absolute inline-flex h-full w-full rounded-full bg-accent-blue opacity-60 animate-ping" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-blue" />
        </span>

        <button
          onClick={() => setOpen(true)}
          className="group bg-bg-card border border-border-default border-l-0
            rounded-r-xl px-2 py-5
            shadow-[2px_0_20px_rgba(79,135,255,0.2)]
            hover:bg-accent-blue hover:border-accent-blue hover:shadow-[2px_0_24px_rgba(79,135,255,0.5)]
            transition-all duration-200"
          title={"스팀 게임 검색하고 등록하기"}
        >
          <span className="flex flex-col items-center gap-2">
            {/* 검색 아이콘 */}
            <svg
              className="w-4 h-4 text-text-secondary group-hover:text-white transition-colors"
              fill="none" stroke="currentColor" strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            {/* 세로 텍스트 — vertical-lr: 위→아래로 자연스럽게 읽힘 */}
            <span
              className="text-[10px] font-semibold text-text-muted group-hover:text-white transition-colors whitespace-nowrap"
              style={{ writingMode: "vertical-lr" }}
            >
              {"게임 등록하기"}
            </span>
          </span>
        </button>
        </div>
      </div>

      {/* 검색 모달 */}
      {open && <SearchModal onClose={() => setOpen(false)} />}
    </>
  );
}
