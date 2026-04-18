"use client";
import Image from "next/image";
import Link from "next/link";
import Badge from "@/components/shared/Badge";
import type { Game } from "@/types";

// Sheets에서 읽은 boolean 문자열을 실제 boolean으로 변환
function parseBool(v: boolean | string | undefined): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toUpperCase() === "TRUE";
  return false;
}

function daysSince(dateStr: string): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

interface GameCardProps {
  game: Game;
}

export default function GameCard({ game }: GameCardProps) {
  const days = daysSince(game.last_event_date);
  const daysColor =
    days >= 60 ? "text-accent-red" : days >= 30 ? "text-accent-orange" : "text-text-muted";

  const isFree = parseBool(game.is_free);
  const sentimentRate =
    game.latest_sentiment_rate !== undefined && game.latest_sentiment_rate !== ""
      ? Number(game.latest_sentiment_rate)
      : null;

  const eventCount =
    game.event_count !== undefined && game.event_count !== ""
      ? Number(game.event_count)
      : null;

  return (
    <Link
      href={`/game/${game.appid}`}
      className="group bg-bg-card border border-border-default hover:border-border-hover rounded-xl overflow-hidden transition-all hover:shadow-lg hover:shadow-black/30 hover:-translate-y-0.5"
    >
      {/* 썸네일 */}
      <div className="relative aspect-[460/215] w-full overflow-hidden">
        {game.thumbnail ? (
          <Image
            src={game.thumbnail}
            alt={game.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-bg-secondary" />
        )}
        {isFree && (
          <span className="absolute top-2 right-2 text-xs bg-accent-green/90 text-white px-2 py-0.5 rounded font-medium">
            F2P
          </span>
        )}
        {/* 평가 뱃지 (우측 상단, F2P와 겹치지 않게) */}
        {sentimentRate !== null && !isFree && (
          <div className="absolute top-2 right-2">
            <Badge rate={sentimentRate} size="sm" />
          </div>
        )}
        {sentimentRate !== null && isFree && (
          <div className="absolute top-2 left-2">
            <Badge rate={sentimentRate} size="sm" />
          </div>
        )}
      </div>

      {/* 카드 하단 정보 */}
      <div className="p-3">
        <p className="font-semibold text-text-primary truncate text-sm">
          {game.name_kr || game.name}
        </p>
        {game.name_kr && game.name_kr !== game.name && (
          <p className="text-xs text-text-muted truncate mt-0.5">{game.name}</p>
        )}

        {/* 메타 정보 줄 */}
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>리뷰 {Number(game.totalReviews || 0).toLocaleString()}건</span>
            {eventCount !== null && eventCount > 0 && (
              <span className="text-text-muted">이벤트 {eventCount}건</span>
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            {game.release_date ? (
              <span className="text-text-muted">{game.release_date}</span>
            ) : (
              <span />
            )}
            {days > 0 && (
              <span className={daysColor}>{days}일 전 업데이트</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
