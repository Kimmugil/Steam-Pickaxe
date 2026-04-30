"use client";
import { useState } from "react";
import Link from "next/link";
import type { Game } from "@/types";

type RateSort = "desc" | "asc";

export default function RateSection({ games }: { games: Game[] }) {
  const [order, setOrder] = useState<RateSort>("desc");

  const sorted = [...games].sort((a, b) =>
    order === "desc"
      ? (Number(b.steam_positive_rate) || 0) - (Number(a.steam_positive_rate) || 0)
      : (Number(a.steam_positive_rate) || 0) - (Number(b.steam_positive_rate) || 0)
  );

  return (
    <>
      {/* 섹션 헤더 */}
      <div className="px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">📊 긍정률</h3>
        <div className="flex gap-1">
          {(["desc", "asc"] as RateSort[]).map((o) => (
            <button
              key={o}
              onClick={() => setOrder(o)}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                order === o
                  ? "border-accent-blue text-accent-blue bg-accent-blue/10"
                  : "border-border-default text-text-muted hover:border-text-muted/50"
              }`}
            >
              {o === "desc" ? "높은순" : "낮은순"}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      <div className="px-4 pb-3 space-y-2.5">
        {sorted.map((game, idx) => {
          const rate = Number(game.steam_positive_rate);
          const barColor  = rate >= 80 ? "bg-accent-green"  : rate >= 60 ? "bg-accent-yellow"  : "bg-accent-red";
          const rateColor = rate >= 80 ? "text-accent-green": rate >= 60 ? "text-accent-yellow" : "text-accent-red";
          return (
            <Link
              key={game.appid}
              href={`/game/${game.appid}`}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity group"
            >
              <span className="text-[10px] text-text-muted w-3 text-right flex-shrink-0">{idx + 1}</span>
              <p className="text-xs text-text-primary truncate flex-1 group-hover:text-accent-blue transition-colors">
                {game.name_kr || game.name}
              </p>
              <div className="w-14 h-1.5 rounded-full bg-bg-secondary flex-shrink-0">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(rate, 100)}%` }} />
              </div>
              <span className={`text-[11px] font-semibold ${rateColor} w-8 text-right tabular-nums flex-shrink-0`}>
                {rate.toFixed(0)}%
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
