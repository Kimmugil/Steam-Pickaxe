"use client";
import Link from "next/link";
import { useState } from "react";
import type { Game } from "@/types";

type SortKey = "default" | "rate" | "event";

function daysSince(d: string | undefined) {
  if (!d) return 9999;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}
function fmtRelative(d: string | undefined) {
  if (!d) return "—";
  const n = daysSince(d);
  if (n === 0) return "오늘";
  if (n <= 7)  return `${n}일 전`;
  if (n <= 30) return `${Math.ceil(n / 7)}주 전`;
  return `${Math.ceil(n / 30)}개월 전`;
}

export default function GameTable({ games }: { games: Game[] }) {
  const [sort, setSort] = useState<SortKey>("default");

  const sorted = [...games].sort((a, b) => {
    if (sort === "rate")  return (Number(b.steam_positive_rate) || 0) - (Number(a.steam_positive_rate) || 0);
    if (sort === "event") return (b.last_event_date ?? "").localeCompare(a.last_event_date ?? "");
    return (Number(a.sort_order) || 9999) - (Number(b.sort_order) || 9999);
  });

  return (
    <div>
      {/* 정렬 토글 */}
      <div className="flex gap-2 mb-3">
        {([
          { key: "default", label: "기본순" },
          { key: "rate",    label: "긍정률순" },
          { key: "event",   label: "최근 업데이트순" },
        ] as const).map(({ key, label }) => (
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

      <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
        {sorted.map((game, i) => {
          const steamRate  = Number(game.steam_positive_rate) || 0;
          const latestRate = Number(game.latest_sentiment_rate) || 0;
          const hasTrend   = latestRate > 0 && steamRate > 0;
          const delta      = hasTrend ? latestRate - steamRate : 0;
          const trend      = hasTrend && Math.abs(delta) > 10 ? (delta > 0 ? "up" : "down") : "stable";

          const barColor  = steamRate >= 80 ? "bg-accent-green" : steamRate >= 60 ? "bg-accent-yellow" : "bg-accent-red";
          const rateColor = steamRate >= 80 ? "text-accent-green" : steamRate >= 60 ? "text-accent-yellow" : "text-accent-red";

          const hasShift   = game.latest_shift_date && daysSince(game.latest_shift_date) <= 45;
          const isDecline  = game.latest_shift_direction === "decline";

          return (
            <Link
              key={game.appid}
              href={`/game/${game.appid}`}
              className={`flex items-center gap-4 px-4 py-3 transition-colors hover:bg-bg-secondary/60 ${
                i < sorted.length - 1 ? "border-b border-border-default" : ""
              }`}
            >
              {/* 썸네일 */}
              <div className="w-16 h-9 rounded overflow-hidden bg-bg-secondary flex-shrink-0">
                {game.thumbnail && (
                  <img src={game.thumbnail} alt={game.name} className="w-full h-full object-cover" />
                )}
              </div>

              {/* 게임명 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {game.name_kr || game.name}
                </p>
                {game.name_kr && game.name_kr !== game.name && (
                  <p className="text-xs text-text-muted truncate">{game.name}</p>
                )}
              </div>

              {/* 긍정률 바 */}
              <div className="hidden sm:flex items-center gap-2 w-40 flex-shrink-0">
                <div className="flex-1 h-1.5 rounded-full bg-bg-secondary">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(steamRate, 100)}%` }} />
                </div>
                <span className={`text-xs font-semibold ${rateColor} w-8 text-right tabular-nums`}>
                  {steamRate > 0 ? `${steamRate.toFixed(0)}%` : "—"}
                </span>
              </div>

              {/* 추이 */}
              <div className="hidden md:block w-14 text-right flex-shrink-0">
                {hasTrend && (
                  <span className={`text-[11px] font-medium ${
                    trend === "up" ? "text-accent-green" : trend === "down" ? "text-accent-red" : "text-text-muted"
                  }`}>
                    {trend === "up" ? "↑ 상승" : trend === "down" ? "↓ 하락" : "→ 안정"}
                  </span>
                )}
              </div>

              {/* 최근 이벤트 / 급변 배지 */}
              <div className="text-right flex-shrink-0 w-20">
                {hasShift ? (
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    isDecline ? "bg-accent-red/15 text-accent-red" : "bg-accent-green/15 text-accent-green"
                  }`}>
                    {isDecline ? "📉 급락" : "📈 회복"}
                  </span>
                ) : (
                  <span className={`text-xs ${
                    daysSince(game.last_event_date) > 60 ? "text-accent-red/70" : "text-text-muted"
                  }`}>
                    {fmtRelative(game.last_event_date)}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
