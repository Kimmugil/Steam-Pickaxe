"use client";
import { useState } from "react";
import Link from "next/link";
import type { Game } from "@/types";

function fmtRelative(d: string | undefined) {
  if (!d) return "";
  const n = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (n === 0) return "오늘";
  if (n <= 7)  return `${n}일 전`;
  if (n <= 30) return `${Math.ceil(n / 7)}주 전`;
  return `${Math.ceil(n / 30)}개월 전`;
}

export default function EventSection({ games }: { games: Game[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* 헤더 (토글 버튼) */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-bg-secondary/40 transition-colors text-left"
      >
        <h3 className="text-sm font-semibold text-text-primary">🔔 이벤트 감지</h3>
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          최근 2주 {games.length}건
          <span className="text-[10px]">{expanded ? "▲" : "▼"}</span>
        </span>
      </button>

      {/* 펼침 목록 */}
      {expanded && (
        <div>
          {games.length === 0 ? (
            <p className="px-4 py-4 text-xs text-text-muted text-center">최근 14일 내 이벤트 없음</p>
          ) : (
            games.map((g) => {
              const externalUrl = g.latest_official_event_url;
              const inner = (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">{g.name_kr || g.name}</p>
                    {g.latest_official_event_title && (
                      <p className="text-[10px] text-text-muted truncate mt-0.5">{g.latest_official_event_title}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-text-muted flex-shrink-0 mt-0.5">
                    {fmtRelative(g.latest_official_event_date)}
                  </span>
                </>
              );

              return externalUrl ? (
                <a
                  key={g.appid}
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 px-4 py-3 hover:bg-bg-secondary/60 transition-colors border-b border-border-default/40 last:border-b-0"
                >
                  {inner}
                </a>
              ) : (
                <Link
                  key={g.appid}
                  href={`/game/${g.appid}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-bg-secondary/60 transition-colors border-b border-border-default/40 last:border-b-0"
                >
                  {inner}
                </Link>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
