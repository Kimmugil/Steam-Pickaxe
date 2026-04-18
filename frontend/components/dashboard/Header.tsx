"use client";
import Image from "next/image";
import Badge from "@/components/shared/Badge";
import { InfoIcon } from "@/components/shared/Tooltip";
import { useUiText } from "@/contexts/UiTextContext";
import type { Game } from "@/types";

function parseBool(v: boolean | string | undefined): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toUpperCase() === "TRUE";
  return false;
}

interface HeaderProps {
  game: Game;
  currentCcu?: number;
  topSentimentRate?: number;
}

/** K/M 없이 순수 정수 콤마 포맷 (추정 소유자 등) */
function formatInt(n: number | string): string {
  const v = Number(n);
  if (!v) return "-";
  return v.toLocaleString();
}

/** K/M 약어 포맷 (기타 지표) */
function formatNum(n: number | string): string {
  const v = Number(n);
  if (!v) return "-";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

function formatPlaytime(minutes: number): string {
  if (!minutes) return "-";
  const h = Math.round(minutes / 60);
  return `${h}시간`;
}

export default function Header({ game, currentCcu, topSentimentRate }: HeaderProps) {
  const { t } = useUiText();

  const ccuPct = game.peak_ccu && currentCcu
    ? Math.round((currentCcu / Number(game.peak_ccu)) * 100)
    : null;

  const retentionRate = game.owners_estimate && game.active_players_2weeks
    ? ((Number(game.active_players_2weeks) / Number(game.owners_estimate)) * 100).toFixed(1)
    : null;

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

        {/* SteamSpy 지표 요약 */}
        <div className="mt-5 pt-4 border-t border-border-default grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatItem label={t("STAT_OWNERS_LABEL")}        value={formatInt(game.owners_estimate)}            tooltip={t("STAT_OWNERS_TOOLTIP")} />
          <StatItem label={t("STAT_AVG_PLAYTIME_LABEL")}  value={formatPlaytime(Number(game.avg_playtime))}  tooltip={t("STAT_AVG_PLAYTIME_TOOLTIP")} />
          <StatItem label={t("STAT_MEDIAN_PLAYTIME_LABEL")} value={formatPlaytime(Number(game.median_playtime))} tooltip={t("STAT_MEDIAN_PLAYTIME_TOOLTIP")} />
          <StatItem label={t("STAT_ACTIVE_2W_LABEL")}     value={formatNum(game.active_players_2weeks)}      tooltip={t("STAT_ACTIVE_2W_TOOLTIP")} />
          <StatItem label={t("STAT_RETENTION_LABEL")}     value={retentionRate ? `${retentionRate}%` : "-"}  tooltip={t("STAT_RETENTION_TOOLTIP")} />
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

function StatItem({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  return (
    <div className="bg-bg-card rounded-lg px-3 py-2">
      <div className="flex items-center">
        <span className="text-xs text-text-muted">{label}</span>
        {tooltip && <InfoIcon tooltip={tooltip} />}
      </div>
      <p className="text-sm font-semibold text-text-primary mt-0.5">{value}</p>
    </div>
  );
}
