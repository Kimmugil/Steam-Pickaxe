"use client";
import Image from "next/image";
import Link from "next/link";
import Badge from "@/components/shared/Badge";
import type { Game } from "@/types";

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
  const daysColor = days >= 60 ? "text-accent-red" : days >= 30 ? "text-accent-orange" : "text-text-muted";
  const rate = Number(game.totalReviews) > 0
    ? Math.round((Number(game.totalReviews) / (Number(game.totalReviews) || 1)) * 100)
    : 0;

  // games 탭에 긍정률이 직접 없으므로 timeline 최신값 사용 불가 — 별도 필드 필요 시 확장
  const displayRate = 0; // 홈에서는 뱃지 표시 생략 or 0

  return (
    <Link
      href={`/game/${game.appid}`}
      className="group bg-bg-card border border-border-default hover:border-border-hover rounded-xl overflow-hidden transition-all hover:shadow-lg hover:shadow-black/30 hover:-translate-y-0.5"
    >
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
        {game.is_free && (
          <span className="absolute top-2 right-2 text-xs bg-accent-green/90 text-white px-2 py-0.5 rounded font-medium">
            F2P
          </span>
        )}
      </div>

      <div className="p-4">
        <p className="font-semibold text-text-primary truncate text-sm">{game.name_kr || game.name}</p>
        {game.name_kr && game.name_kr !== game.name && (
          <p className="text-xs text-text-muted truncate mt-0.5">{game.name}</p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">
              리뷰 {Number(game.totalReviews || 0).toLocaleString()}건
            </span>
          </div>
          {days > 0 && (
            <span className={`text-xs ${daysColor}`}>
              {days}일 전 업데이트
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
