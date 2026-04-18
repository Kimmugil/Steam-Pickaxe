"use client";
import Image from "next/image";
import Link from "next/link";
import Badge, { getSteamLabel } from "@/components/shared/Badge";
import { useUiText } from "@/contexts/UiTextContext";
import type { Game } from "@/types";

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
  const { t } = useUiText();

  const eventDays = daysSince(game.last_event_date);
  const eventDaysColor =
    eventDays >= 60 ? "text-accent-red" : eventDays >= 30 ? "text-accent-orange" : "text-text-muted";

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
            {t("BADGE_F2P")}
          </span>
        )}
        {sentimentRate !== null && !isFree && (
          <div className="absolute top-2 right-2">
            <Badge rate={sentimentRate} reviewCount={Number(game.totalReviews || 0)} size="sm" />
          </div>
        )}
        {sentimentRate !== null && isFree && (
          <div className="absolute top-2 left-2">
            <Badge rate={sentimentRate} reviewCount={Number(game.totalReviews || 0)} size="sm" />
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

        <div className="mt-2 space-y-1">
          {/* 리뷰 수 + Steam 평점 레이블 */}
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>{t("CARD_REVIEWS_LABEL", { n: Number(game.totalReviews || 0).toLocaleString() })}</span>
            {sentimentRate !== null && (
              <span className="text-text-muted font-medium">
                {getSteamLabel(sentimentRate, Number(game.totalReviews || 0))}
              </span>
            )}
          </div>

          {/* 이벤트 수 */}
          {eventCount !== null && eventCount > 0 && (
            <div className="text-xs text-text-muted">{t("CARD_EVENTS_LABEL", { n: eventCount })}</div>
          )}

          {/* 출시일 + 최근 이벤트 날짜 */}
          <div className="flex items-center justify-between text-xs">
            {game.release_date ? (
              <span className="text-text-muted">{game.release_date}</span>
            ) : (
              <span />
            )}
            {eventDays > 0 && game.last_event_date && (
              <span className={`${eventDaysColor} flex items-center gap-1`}>
                <span className="text-text-muted">{t("CARD_LAST_EVENT_LABEL")}:</span>
                {t("CARD_DAYS_AGO", { n: eventDays })}
              </span>
            )}
          </div>

          {/* AI 분석 날짜 (이벤트 날짜와 분리) */}
          {game.ai_briefing_date && (
            <div className="flex items-center justify-end text-xs text-text-muted">
              <span>{t("CARD_AI_DATE_LABEL")}: {game.ai_briefing_date}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
