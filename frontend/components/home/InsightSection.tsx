import Image from "next/image";
import Link from "next/link";
import type { Game } from "@/types";

interface Props {
  games: Game[];
  uiText: Record<string, string>;
}

const FALLBACK: Record<string, string> = {
  INSIGHT_SHIFT_TITLE:    "⚡ 최근 평가 급변 감지",
  INSIGHT_SHIFT_DECLINE:  "📉 급락",
  INSIGHT_SHIFT_RECOVERY: "📈 회복",
  INSIGHT_UPDATE_TITLE:   "🔧 최근 주요 업데이트",
  INSIGHT_RATE_TITLE:     "📊 긍정률 현황",
  INSIGHT_RATE_UP:        "↑ 상승 중",
  INSIGHT_RATE_DOWN:      "↓ 하락 중",
  INSIGHT_RATE_STABLE:    "→ 안정",
};

function t(uiText: Record<string, string>, key: string): string {
  return uiText[key] ?? FALLBACK[key] ?? key;
}

function fmtDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  return `${Number(parts[1])}월 ${Number(parts[2])}일`;
}

function daysSince(dateStr: string | undefined): number {
  if (!dateStr) return 9999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function GameThumb({ game }: { game: Game }) {
  return (
    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-bg-secondary">
      {game.thumbnail ? (
        <Image src={game.thumbnail} alt={game.name} width={48} height={48} className="object-cover w-full h-full" />
      ) : (
        <div className="w-full h-full bg-bg-secondary" />
      )}
    </div>
  );
}

export default function InsightSection({ games, uiText }: Props) {
  // ── 1. 급변 감지 (60일 이내) ────────────────────────────────────────────
  const shiftGames = games
    .filter(g => g.latest_shift_date && daysSince(g.latest_shift_date) <= 60)
    .sort((a, b) => (b.latest_shift_date ?? "").localeCompare(a.latest_shift_date ?? ""));

  // ── 2. 최근 공식 이벤트 (21일 이내) ─────────────────────────────────────
  const updateGames = games
    .filter(g => g.latest_official_event_date && daysSince(g.latest_official_event_date) <= 21)
    .sort((a, b) => (b.latest_official_event_date ?? "").localeCompare(a.latest_official_event_date ?? ""));

  // ── 3. 긍정률 현황 (steam_positive_rate 기준, 전체 표시) ─────────────────
  const rateGames = [...games]
    .filter(g => g.steam_positive_rate !== undefined && g.steam_positive_rate !== "")
    .sort((a, b) => Number(b.steam_positive_rate) - Number(a.steam_positive_rate));

  const hasInsights = shiftGames.length > 0 || updateGames.length > 0 || rateGames.length > 0;
  if (!hasInsights) return null;

  return (
    <div className="space-y-8">

      {/* ── 급변 감지 섹션 ─────────────────────────────────────────────── */}
      {shiftGames.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">
            {t(uiText, "INSIGHT_SHIFT_TITLE")}
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {shiftGames.map(game => {
              const isDecline = game.latest_shift_direction === "decline";
              const delta = game.latest_shift_delta ? parseFloat(game.latest_shift_delta) : null;
              return (
                <Link
                  key={game.appid}
                  href={`/game/${game.appid}`}
                  className="flex-shrink-0 w-64 bg-bg-card border border-border-default hover:border-border-hover rounded-xl p-3 flex items-center gap-3 transition-all hover:shadow-md hover:shadow-black/20"
                >
                  <GameThumb game={game} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {game.name_kr || game.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                        isDecline
                          ? "bg-accent-red/15 text-accent-red"
                          : "bg-accent-green/15 text-accent-green"
                      }`}>
                        {isDecline ? t(uiText, "INSIGHT_SHIFT_DECLINE") : t(uiText, "INSIGHT_SHIFT_RECOVERY")}
                        {delta !== null && ` ${delta > 0 ? "+" : ""}${delta.toFixed(1)}pp`}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-1">
                      {fmtDate(game.latest_shift_date)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 최근 업데이트 섹션 ──────────────────────────────────────────── */}
      {updateGames.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">
            {t(uiText, "INSIGHT_UPDATE_TITLE")}
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {updateGames.map(game => (
              <Link
                key={game.appid}
                href={`/game/${game.appid}`}
                className="flex-shrink-0 w-72 bg-bg-card border border-border-default hover:border-border-hover rounded-xl p-3 flex items-center gap-3 transition-all hover:shadow-md hover:shadow-black/20"
              >
                <GameThumb game={game} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {game.name_kr || game.name}
                  </p>
                  {game.latest_official_event_title && (
                    <p className="text-xs text-text-secondary truncate mt-0.5">
                      {game.latest_official_event_title}
                    </p>
                  )}
                  <p className="text-[10px] text-text-muted mt-1">
                    {fmtDate(game.latest_official_event_date)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── 긍정률 현황 섹션 ────────────────────────────────────────────── */}
      {rateGames.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">
            {t(uiText, "INSIGHT_RATE_TITLE")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {rateGames.map((game, idx) => {
              const steamRate = Number(game.steam_positive_rate) || 0;
              const latestRate = Number(game.latest_sentiment_rate) || 0;
              const hasTrend = latestRate > 0;
              const delta = hasTrend ? latestRate - steamRate : 0;
              const trend = hasTrend && Math.abs(delta) > 10
                ? (delta > 0 ? "up" : "down")
                : "stable";

              const barColor =
                steamRate >= 80 ? "bg-accent-green" :
                steamRate >= 60 ? "bg-accent-yellow" :
                "bg-accent-red";
              const rateColor =
                steamRate >= 80 ? "text-accent-green" :
                steamRate >= 60 ? "text-accent-yellow" :
                "text-accent-red";
              const trendColor =
                trend === "up" ? "text-accent-green" :
                trend === "down" ? "text-accent-red" :
                "text-text-muted";
              const trendLabel =
                trend === "up"   ? t(uiText, "INSIGHT_RATE_UP") :
                trend === "down" ? t(uiText, "INSIGHT_RATE_DOWN") :
                                   t(uiText, "INSIGHT_RATE_STABLE");

              return (
                <Link
                  key={game.appid}
                  href={`/game/${game.appid}`}
                  className="bg-bg-card border border-border-default hover:border-border-hover rounded-xl px-4 py-3 flex items-center gap-3 transition-all hover:shadow-md hover:shadow-black/20"
                >
                  {/* 순위 */}
                  <span className="text-xs text-text-muted w-5 text-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <GameThumb game={game} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {game.name_kr || game.name}
                    </p>
                    {/* 긍정률 바 */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 rounded-full bg-bg-secondary">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${Math.min(steamRate, 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold ${rateColor} w-10 text-right`}>
                        {steamRate.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  {/* 추이 */}
                  {hasTrend && (
                    <span className={`text-[10px] font-medium ${trendColor} flex-shrink-0 w-14 text-right`}>
                      {trendLabel}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}
