"use client";
import { useState } from "react";
import GameCard from "@/components/home/GameCard";
import type { Game } from "@/types";

type SortKey = "latest" | "rate_desc" | "rate_asc" | "registered";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "latest",      label: "최신순" },
  { key: "rate_desc",   label: "평점 높은순" },
  { key: "rate_asc",    label: "평점 낮은순" },
  { key: "registered",  label: "등록일순" },
];

/** 게임의 가장 최근 활동 날짜 (AI 분석 / 이벤트 / 급변 / 업데이트 중 최신) */
function latestActivity(g: Game): string {
  return [
    g.ai_briefing_date,
    g.last_event_date,
    g.latest_shift_date,
    g.latest_official_event_date,
  ]
    .filter((d): d is string => !!d)
    .sort()
    .reverse()[0] ?? "";
}

export default function GameCardGrid({ games }: { games: Game[] }) {
  const [sort, setSort] = useState<SortKey>("latest");

  const sorted = [...games].sort((a, b) => {
    switch (sort) {
      case "latest":
        return latestActivity(b).localeCompare(latestActivity(a));
      case "rate_desc":
        return (Number(b.steam_positive_rate) || 0) - (Number(a.steam_positive_rate) || 0);
      case "rate_asc":
        return (Number(a.steam_positive_rate) || 0) - (Number(b.steam_positive_rate) || 0);
      case "registered":
        return (a.collection_started_at ?? "").localeCompare(b.collection_started_at ?? "");
      default:
        return 0;
    }
  });

  return (
    <div>
      {/* 정렬 토글 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {SORT_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              sort === key
                ? "border-accent-blue text-accent-blue bg-accent-blue/10"
                : "border-border-default text-text-muted hover:border-text-muted/50 hover:text-text-secondary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 카드 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {sorted.map((game) => (
          <GameCard key={game.appid} game={game} />
        ))}
      </div>
    </div>
  );
}
