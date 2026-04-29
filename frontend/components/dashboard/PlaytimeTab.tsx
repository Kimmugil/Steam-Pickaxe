"use client";
import { useMemo } from "react";
import { useUiText } from "@/contexts/UiTextContext";

interface PlaytimeSeg {
  total: number;
  positive: number;
  rate: number;
}

interface PlaytimeStats {
  p25: number;
  p75: number;
  new: PlaytimeSeg;
  mid: PlaytimeSeg;
  heavy: PlaytimeSeg;
  total: number;
}

interface PlaytimeTabProps {
  playtimeStats?: string;      // JSON string from game.playtime_stats
  playtimeStatsDate?: string;  // YYYY-MM-DD
}

function fmtMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

export default function PlaytimeTab({ playtimeStats, playtimeStatsDate }: PlaytimeTabProps) {
  const { t } = useUiText();

  const stats = useMemo<PlaytimeStats | null>(() => {
    if (!playtimeStats) return null;
    try {
      return JSON.parse(playtimeStats) as PlaytimeStats;
    } catch {
      return null;
    }
  }, [playtimeStats]);

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-text-muted">
        <p className="text-sm">{t("PLAYTIME_STATS_NO_DATA")}</p>
      </div>
    );
  }

  const segments = [
    {
      key: "new" as const,
      label: t("PLAYTIME_NEW_LABEL"),
      range: t("PLAYTIME_NEW_RANGE"),
      threshold: `${fmtMinutes(stats.p25)} ${t("PLAYTIME_THRESHOLD_NEW")}`,
    },
    {
      key: "mid" as const,
      label: t("PLAYTIME_MID_LABEL"),
      range: t("PLAYTIME_MID_RANGE"),
      threshold: `${fmtMinutes(stats.p25)} ~ ${fmtMinutes(stats.p75)}`,
    },
    {
      key: "heavy" as const,
      label: t("PLAYTIME_HEAVY_LABEL"),
      range: t("PLAYTIME_HEAVY_RANGE"),
      threshold: `${fmtMinutes(stats.p75)} ${t("PLAYTIME_THRESHOLD_HEAVY")}`,
    },
  ] as const;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium text-text-primary">{t("PLAYTIME_STATS_TITLE")}</h3>
        <p className="text-xs text-text-muted mt-0.5">{t("PLAYTIME_STATS_DESC")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {segments.map(({ key, label, range, threshold }) => {
          const seg = stats[key];
          const rateColor =
            seg.rate >= 80 ? "text-accent-green" :
            seg.rate >= 40 ? "text-accent-yellow" :
            "text-accent-red";
          const barColor =
            seg.rate >= 80 ? "bg-accent-green" :
            seg.rate >= 40 ? "bg-accent-yellow" :
            "bg-accent-red";
          const totalPct = stats.total > 0 ? Math.round((seg.total / stats.total) * 100) : 0;

          return (
            <div key={key} className="bg-bg-secondary border border-border-default rounded-xl p-4">
              <div className="text-sm font-medium text-text-primary">{label}</div>
              <div className="text-xs text-text-muted mb-1">{range}</div>
              <div className="text-[10px] text-text-muted mb-2 font-mono">{threshold}</div>
              <div className={`text-2xl font-bold ${rateColor}`}>{seg.rate}%</div>
              <div className="h-2 rounded-full bg-bg-card mt-2 mb-1">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${seg.rate}%` }} />
              </div>
              <div className="flex justify-between text-xs text-text-muted mt-1">
                <span>{seg.total.toLocaleString()}건</span>
                <span>전체 {totalPct}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-text-muted pt-1 border-t border-border-default">
        <span>{t("PLAYTIME_TOTAL_REVIEWS", { total: stats.total.toLocaleString() })}</span>
        {playtimeStatsDate && (
          <span>{t("PLAYTIME_STATS_DATE_LABEL")} {playtimeStatsDate}</span>
        )}
      </div>
    </div>
  );
}
