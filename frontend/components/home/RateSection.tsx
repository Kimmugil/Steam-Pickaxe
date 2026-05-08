"use client";
import { useState } from "react";
import Link from "next/link";
import type { Game } from "@/types";
import { useUiText } from "@/contexts/UiTextContext";

type RateSort = "desc" | "asc";

const LIMIT = 5;

export default function RateSection({ games }: { games: Game[] }) {
  const [order, setOrder]       = useState<RateSort>("desc");
  const [showAll, setShowAll]   = useState(false);
  const { t } = useUiText();

  const sorted = [...games].sort((a, b) =>
    order === "desc"
      ? (Number(b.steam_positive_rate) || 0) - (Number(a.steam_positive_rate) || 0)
      : (Number(a.steam_positive_rate) || 0) - (Number(b.steam_positive_rate) || 0)
  );

  const visible   = showAll ? sorted : sorted.slice(0, LIMIT);
  const hasMore   = sorted.length > LIMIT;

  return (
    <>
      {/* 섹션 헤더 */}
      <div className="px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">{t("INSIGHT_RATE_TITLE")}</h3>
        <div className="flex gap-1">
          {(["desc", "asc"] as RateSort[]).map((o) => (
            <button
              key={o}
              onClick={() => { setOrder(o); setShowAll(false); }}
              className={`text-[10px] px-2.5 py-0.5 rounded-full border transition-colors ${
                order === o
                  ? "border-accent-blue text-accent-blue bg-accent-blue/10"
                  : "border-border-default text-text-muted hover:border-border-hover hover:text-text-secondary"
              }`}
            >
              {o === "desc" ? t("RATE_SORT_DESC") : t("RATE_SORT_ASC")}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      <div className="px-4 pb-3 space-y-2.5">
        {visible.map((game, idx) => {
          const rate      = Number(game.steam_positive_rate);
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
              <div className="w-20 h-1.5 rounded-full bg-bg-secondary flex-shrink-0">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(rate, 100)}%` }} />
              </div>
              <span className={`text-[11px] font-semibold ${rateColor} w-8 text-right tabular-nums flex-shrink-0`}>
                {rate.toFixed(0)}%
              </span>
            </Link>
          );
        })}

        {/* 더보기 / 접기 */}
        {hasMore && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="w-full pt-1 text-[11px] text-text-muted hover:text-accent-blue transition-colors text-center"
          >
            {showAll
              ? t("RATE_COLLAPSE")
              : t("RATE_SHOW_MORE", { n: String(sorted.length - LIMIT) })}
          </button>
        )}
      </div>
    </>
  );
}
