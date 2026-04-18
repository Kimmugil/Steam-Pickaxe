"use client";
import Image from "next/image";
import Badge from "@/components/shared/Badge";
import { useUiText } from "@/contexts/UiTextContext";
import type { Game } from "@/types";

function parseBool(v: boolean | string | undefined): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toUpperCase() === "TRUE";
  return false;
}

const KR_DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/**
 * Steam API의 release_date 문자열을 한국어 형식으로 변환합니다.
 * 입력 예: "18 Nov, 2021" / "Nov 18, 2021" / "2021-11-18"
 * 출력 예: "2021년 11월 18일(목)"
 */
function formatReleaseDateKr(raw: string | undefined): string {
  if (!raw) return "-";

  let date: Date | null = null;

  // ISO 형식: 2021-11-18
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    date = new Date(raw.trim() + "T12:00:00Z");
  } else {
    // Steam API 형식: "18 Nov, 2021" 또는 "Nov 18, 2021"
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) date = parsed;
  }

  if (!date || isNaN(date.getTime())) return raw;

  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const day = KR_DAYS[date.getUTCDay()];
  return `${y}년 ${m}월 ${d}일(${day})`;
}

interface HeaderProps {
  game: Game;
  currentCcu?: number;
  topSentimentRate?: number;
}


export default function Header({ game, currentCcu, topSentimentRate }: HeaderProps) {
  const { t } = useUiText();

  const ccuPct = game.peak_ccu && currentCcu
    ? Math.round((currentCcu / Number(game.peak_ccu)) * 100)
    : null;

  const genres = game.genres ? game.genres.split(",").map(g => g.trim()).filter(Boolean) : [];

  return (
    <div className="bg-bg-secondary border-b border-border-default">
      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        {/* 상단: 게임 기본 정보 */}
        <div className="flex gap-6 items-start">
          {game.thumbnail && (
            <div className="shrink-0 rounded-lg overflow-hidden border border-border-default">
              <Image src={game.thumbnail} alt={game.name} width={232} height={109} className="object-cover" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-text-primary">{game.name_kr || game.name}</h1>
              {parseBool(game.is_free) && (
                <span className="text-xs bg-accent-green/20 text-accent-green border border-accent-green/30 px-2 py-0.5 rounded font-medium">
                  {t("BADGE_F2P")}
                </span>
              )}
              {parseBool(game.is_early_access) && (
                <span className="text-xs bg-accent-yellow/20 text-accent-yellow border border-accent-yellow/30 px-2 py-0.5 rounded font-medium">
                  {t("BADGE_EARLY_ACCESS")}
                </span>
              )}
            </div>
            {game.name_kr && game.name_kr !== game.name && (
              <p className="text-text-secondary text-sm mt-0.5">{game.name}</p>
            )}

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-xs text-text-muted">{t("HEADER_APPID_LABEL")} {game.appid}</span>
              <a
                href={`https://store.steampowered.com/app/${game.appid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent-blue hover:underline"
              >
                {t("HEADER_STEAM_LINK")}
              </a>
            </div>

            {/* 핵심 지표 */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              {topSentimentRate !== undefined && (
                <Badge rate={topSentimentRate} reviewCount={Number(game.totalReviews || 0)} size="lg" showLabel />
              )}
              <div className="text-sm text-text-secondary">
                {t("HEADER_REVIEWS_LABEL")}{" "}
                <span className="text-text-primary font-medium">
                  {Number(game.totalReviews || 0).toLocaleString()}{t("HEADER_REVIEWS_UNIT")}
                </span>
              </div>
              {currentCcu !== undefined && (
                <div className="text-sm text-text-secondary">
                  {t("HEADER_CCU_LABEL")}{" "}
                  <span className="text-text-primary font-medium">
                    {currentCcu.toLocaleString()}{t("HEADER_CCU_UNIT")}
                  </span>
                  {ccuPct !== null && (
                    <span className="ml-1 text-xs text-text-muted">
                      ({t("HEADER_CCU_PEAK_LABEL")} {Number(game.peak_ccu).toLocaleString()}{t("HEADER_CCU_UNIT")} {t("HEADER_CCU_PEAK_SUFFIX")} {ccuPct}%)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 게임 기본 정보 바 */}
        <div className="mt-5 pt-4 border-t border-border-default grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetaItem label="장르"   value={genres.length > 0 ? genres.join(" · ") : "-"} />
          <MetaItem label="출시일" value={formatReleaseDateKr(game.release_date)} />
          <MetaItem label="개발사" value={game.developer || "-"} />
          <MetaItem label="배급사" value={game.publisher || "-"} />
          <MetaItem label="판매가" value={game.price || (parseBool(game.is_free) ? "무료" : "-")} />
        </div>

        {/* AI 브리핑 */}
        {game.ai_briefing && (
          <div className="mt-4 bg-bg-card border border-accent-blue/20 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <span className="text-accent-blue text-sm mt-0.5 shrink-0">{t("HEADER_AI_BRIEFING_TITLE")}</span>
              <p className="text-text-secondary text-sm leading-relaxed">{game.ai_briefing}</p>
            </div>
            {game.ai_briefing_date && (
              <p className="text-xs text-text-muted mt-2 text-right">
                {t("HEADER_AI_BRIEFING_DATE")} {game.ai_briefing_date}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-card rounded-lg px-3 py-2">
      <span className="text-xs text-text-muted block">{label}</span>
      <p className="text-sm font-semibold text-text-primary mt-0.5 truncate" title={value}>{value}</p>
    </div>
  );
}
