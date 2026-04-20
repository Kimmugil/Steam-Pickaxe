"use client";
import Image from "next/image";
import Link from "next/link";
import Badge, { getSteamLabel } from "@/components/shared/Badge";
import { useUiText } from "@/contexts/UiTextContext";
import type { Game } from "@/types";

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/** Steam API 날짜를 YYYY-MM-DD로 정규화. 이미 그 형식이면 그대로. */
function toIsoDate(raw: string | undefined): string {
  if (!raw) return "";
  const s = raw.trim();
  // 이미 ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // "Mar 30, 2026"
  const m1 = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m1 && MONTHS[m1[1]]) return `${m1[3]}-${MONTHS[m1[1]]}-${m1[2].padStart(2, "0")}`;
  // "30 Mar, 2026"
  const m2 = s.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (m2 && MONTHS[m2[2]]) return `${m2[3]}-${MONTHS[m2[2]]}-${m2[1].padStart(2, "0")}`;
  return s;
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

  const sentimentRate =
    game.latest_sentiment_rate !== undefined && game.latest_sentiment_rate !== ""
      ? Number(game.latest_sentiment_rate)
      : null;

  const eventCount =
    game.event_count !== undefined && game.event_count !== ""
      ? Number(game.event_count)
      : null;

  const releaseIso = toIsoDate(game.release_date);

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
        {sentimentRate !== null && (
          <div className="absolute top-2 right-2">
            <Badge
              rate={sentimentRate}
              reviewCount={Number(game.totalReviews || 0)}
              size="sm"
              labelOnly
              overlay
            />
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
            {releaseIso ? (
              <span className="text-text-muted">{releaseIso}</span>
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

          {/* AI 분석 날짜+시간 */}
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
