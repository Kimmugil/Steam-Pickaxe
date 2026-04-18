"use client";
import Image from "next/image";
import Badge from "@/components/shared/Badge";
import { InfoIcon } from "@/components/shared/Tooltip";
import type { Game } from "@/types";

// Sheets에서 읽은 boolean 문자열 → 실제 boolean 변환
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
                <span className="text-xs bg-accent-green/20 text-accent-green border border-accent-green/30 px-2 py-0.5 rounded font-medium">F2P</span>
              )}
              {parseBool(game.is_early_access) && (
                <span className="text-xs bg-accent-yellow/20 text-accent-yellow border border-accent-yellow/30 px-2 py-0.5 rounded font-medium">Early Access</span>
              )}
            </div>
            {game.name_kr && game.name_kr !== game.name && (
              <p className="text-text-secondary text-sm mt-0.5">{game.name}</p>
            )}

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-xs text-text-muted">AppID: {game.appid}</span>
              <a
                href={`https://store.steampowered.com/app/${game.appid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent-blue hover:underline"
              >
                Steam 상점 바로가기 ↗
              </a>
            </div>

            {/* 핵심 지표 */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              {topSentimentRate !== undefined && (
                <Badge rate={topSentimentRate} size="lg" showLabel />
              )}
              <div className="text-sm text-text-secondary">
                리뷰 <span className="text-text-primary font-medium">{Number(game.totalReviews || 0).toLocaleString()}건</span>
              </div>
              {currentCcu !== undefined && (
                <div className="text-sm text-text-secondary">
                  현재 CCU <span className="text-text-primary font-medium">{currentCcu.toLocaleString()}명</span>
                  {ccuPct !== null && (
                    <span className="ml-1 text-xs text-text-muted">
                      (역대 최고 {Number(game.peak_ccu).toLocaleString()}명 대비 {ccuPct}%)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SteamSpy 지표 요약 행 (리뷰 전환율 제거, 5개 항목) */}
        <div className="mt-5 pt-4 border-t border-border-default grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatItem
            label="추정 소유자"
            value={formatNum(game.owners_estimate)}
            tooltip="SteamSpy 통계적 추정치입니다. 실제값과 차이가 있을 수 있습니다."
          />
          <StatItem
            label="평균 플레이타임"
            value={formatPlaytime(Number(game.avg_playtime))}
            tooltip="SteamSpy 추정치 기반입니다."
          />
          <StatItem
            label="중간값 플레이타임"
            value={formatPlaytime(Number(game.median_playtime))}
            tooltip="SteamSpy 추정치 기반입니다."
          />
          <StatItem
            label="2주 활성 플레이어"
            value={formatNum(game.active_players_2weeks)}
            tooltip="최근 2주간 플레이한 유저 수. SteamSpy 추정치입니다."
          />
          <StatItem
            label="잔존율"
            value={retentionRate ? `${retentionRate}%` : "-"}
            tooltip="최근 2주 활성 플레이어 ÷ 추정 소유자 수. SteamSpy 추정치 기반으로 절대값이 아닌 상대 비교 지표로 활용하세요."
          />
        </div>

        {/* AI 브리핑 */}
        {game.ai_briefing && (
          <div className="mt-4 bg-bg-card border border-accent-blue/20 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <span className="text-accent-blue text-sm mt-0.5 shrink-0">AI 현황 진단</span>
              <p className="text-text-secondary text-sm leading-relaxed">{game.ai_briefing}</p>
            </div>
            {game.ai_briefing_date && (
              <p className="text-xs text-text-muted mt-2 text-right">
                마지막 분석: {game.ai_briefing_date}
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
