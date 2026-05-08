import Image from "next/image";
import Link from "next/link";
import type { Game } from "@/types";

interface Props {
  games: Game[];
  uiText?: Record<string, string>;
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

export default function InsightSection({ games }: Props) {
  // ── 1. 급변 감지 (60일 이내) ────────────────────────────────────────────
  const shiftGames = games
    .filter(g => g.latest_shift_date && daysSince(g.latest_shift_date) <= 60)
    .sort((a, b) => (b.latest_shift_date ?? "").localeCompare(a.latest_shift_date ?? ""));

  // ── 2. 최근 공식 이벤트 (21일 이내) ─────────────────────────────────────
  const updateGames = games
    .filter(g => g.latest_official_event_date && daysSince(g.latest_official_event_date) <= 21)
    .sort((a, b) => (b.latest_official_event_date ?? "").localeCompare(a.latest_official_event_date ?? ""));

  const hasInsights = shiftGames.length > 0 || updateGames.length > 0;
  if (!hasInsights) return null;

  return (
    <div className="space-y-8">

      {/* ── 급변 감지 섹션 ─────────────────────────────────────────────── */}
      {shiftGames.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">
            {"⚡ 최근 평가 급변 감지"}
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
                        {isDecline ? "📉 급락" : "📈 회복"}
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
            {"🔧 최근 주요 업데이트"}
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

    </div>
  );
}
