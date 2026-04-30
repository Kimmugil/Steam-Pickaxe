"use client";
import { useState } from "react";
import SearchModal from "./SearchModal";

export default function FloatingNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 우측 플로팅 탭 버튼 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 group
          bg-bg-card border border-border-default border-r-0
          rounded-l-xl px-2 py-5 shadow-lg
          hover:bg-accent-blue hover:border-accent-blue
          transition-all duration-200"
        title="스팀 게임 검색하고 등록하기"
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
          {/* 세로 텍스트 */}
          <span
            className="text-[10px] font-semibold text-text-muted group-hover:text-white transition-colors whitespace-nowrap"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)" }}
          >
            게임 등록하기
          </span>
        </span>
      </button>

      {/* 검색 모달 */}
      {open && <SearchModal onClose={() => setOpen(false)} />}
    </>
  );
}
