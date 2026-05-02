"use client";
import Image from "next/image";
import Link from "next/link";
import Badge from "@/components/shared/Badge";
import { useUiText } from "@/contexts/UiTextContext";
import type { Game } from "@/types";

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function toIsoDate(raw: string | undefined): string {
  if (!raw) return "";
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m1 = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m1 && MONTHS[m1[1]]) return `${m1[3]}-${MONTHS[m1[1]]}-${m1[2].padStart(2, "0")}`;
  const m2 = s.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (m2 && MONTHS[m2[2]]) return `${m2[3]}-${MONTHS[m2[2]]}-${m2[1].padStart(2, "0")}`;
  return s;
}

function daysSince(dateStr: string | undefined): number {
  if (!dateStr) return 9999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

interface GameCardProps {
  game: Game;
}

export default function GameCard({ game }: GameCardProps) {
  const { t } = useUiText();

  function fmtAgo(n: number): string {
    if (n === 0) return t("REL_TODAY");
    if (n <= 7)  return t("REL_DAYS_AGO",   { n });
    if (n <= 30) return t("REL_WEEKS_AGO",  { n: Math.ceil(n / 7) });
    return              t("REL_MONTHS_AGO", { n: Math.ceil(n / 30) });
  }

  const sentimentRate =
    game.steam_positive_rate !== undefined && game.steam_positive_rate !== ""
      ? Number(game.steam_positive_rate)
      : game.latest_sentiment_rate !== undefined && game.latest_sentiment_rate !== ""
      ? Number(game.latest_sentiment_rate)
      : null;

  const releaseIso = toIsoDate(game.release_date);

  // 트렌드: 최근 60일 이내 급변
  const shiftDays    = daysSince(game.latest_shift_date);
  const hasShift     = !!game.latest_shift_date && shiftDays <= 60;
  const isDecline    = game.latest_shift_direction === "decline";
  const shiftDelta   = game.latest_shift_delta ? parseFloat(game.latest_shift_delta) : null;

  // 최근 이벤트: 14일 이내 공식 이벤트
  const eventDays      = daysSince(game.latest_official_event_date);
  const hasRecentEvent = !!game.latest_official_event_date && eventDays <= 14;

  const rateColor =
    sentimentRate === null    ? "" :
    sentimentRate >= 80       ? "text-accent-green" :
    sentimentRate >= 60       ? "text-accent-yellow" :
                                "text-accent-red";

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

        {/* AI 미승인 배지 — 좌상단 */}
        {!game.ai_briefing && game.ai_approved !== "true" && (
          <div className="absolute top-2 left-2">
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm border border-accent-orange/50 text-accent-orange">
              {t("BADGE_AI_UNAPPROVED")}
            </span>
          </div>
        )}

        {/* 평가 레이블 배지 — 우상단 */}
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

        {/* 게임명 */}
        <p className="font-semibold text-text-primary truncate text-sm leading-snug">
          {game.name_kr || game.name}
        </p>
        {game.name_kr && game.name_kr !== game.name && (
          <p className="text-xs text-text-muted truncate mt-0.5">{game.name}</p>
        )}

        {/* 메인 지표: 좌측(리뷰+출시일) / 우측(긍정률+트렌드) */}
        <div className="mt-2.5 flex items-end justify-between gap-2">

          {/* 좌측 — 보조 정보 */}
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs text-text-secondary leading-tight">
              {t("CARD_REVIEWS_LABEL", { n: Number(game.totalReviews || 0).toLocaleString() })}
            </p>
            {releaseIso && (
              <p className="text-xs text-text-muted">{releaseIso}</p>
            )}
          </div>

          {/* 우측 — 핵심 지표 */}
          {sentimentRate !== null && sentimentRate > 0 && (
            <div className="text-right flex-shrink-0">
              <p className={`text-2xl font-bold tabular-nums leading-none ${rateColor}`}>
                {sentimentRate.toFixed(0)}%
              </p>
              {hasShift && shiftDelta !== null && (
                <p className={`text-[11px] font-semibold mt-1 tabular-nums ${isDecline ? "text-accent-red" : "text-accent-green"}`}>
                  {isDecline ? "↓" : "↑"} {Math.abs(shiftDelta).toFixed(1)}pp · {fmtAgo(shiftDays)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 최근 공식 이벤트 (14일 이내만 표시) */}
        {hasRecentEvent && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-accent-blue">
            <span className="flex-shrink-0">🔔</span>
            <span className="truncate min-w-0">
              {game.latest_official_event_title
                ? `${game.latest_official_event_title} · ${fmtAgo(eventDays)}`
                : `${t("CARD_RECENT_EVENT_LABEL")} · ${fmtAgo(eventDays)}`
              }
            </span>
          </div>
        )}

      </div>
    </Link>
  );
}
