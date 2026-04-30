import Link from "next/link";
import type { Game } from "@/types";

interface Props {
  games: Game[];
}

function daysSince(d: string | undefined) {
  if (!d) return 9999;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}
function fmtRelative(d: string | undefined) {
  if (!d) return "";
  const n = daysSince(d);
  if (n === 0) return "오늘";
  if (n <= 7)  return `${n}일 전`;
  if (n <= 30) return `${Math.ceil(n / 7)}주 전`;
  return `${Math.ceil(n / 30)}개월 전`;
}

export default function HomeInsightPanel({ games }: Props) {
  // ── 평가 급변 목록 (최근 60일, 날짜 내림차순) ────────────────────────────────
  const shiftGames = games
    .filter(g => g.latest_shift_date && daysSince(g.latest_shift_date) <= 60)
    .sort((a, b) => (b.latest_shift_date ?? "").localeCompare(a.latest_shift_date ?? ""));

  // ── 이벤트 감지 목록 (최근 30일, 날짜 내림차순) ──────────────────────────────
  const eventGames = games
    .filter(g => g.latest_official_event_date && daysSince(g.latest_official_event_date) <= 30)
    .sort((a, b) => (b.latest_official_event_date ?? "").localeCompare(a.latest_official_event_date ?? ""));

  // ── 긍정률 TOP ──────────────────────────────────────────────────────────────
  const rateGames = [...games]
    .filter(g => Number(g.steam_positive_rate) > 0)
    .sort((a, b) => Number(b.steam_positive_rate) - Number(a.steam_positive_rate))
    .slice(0, 6);

  return (
    <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden divide-y divide-border-default">

      {/* ── ⚡ 평가 급변 ─────────────────────────────────────────────── */}
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">⚡ 평가 급변</h3>
      </div>

      <div>
        {shiftGames.length === 0 ? (
          <p className="px-4 py-4 text-xs text-text-muted text-center">최근 60일 내 급변 없음</p>
        ) : (
          shiftGames.map((g) => {
            const isDecline = g.latest_shift_direction === "decline";
            const delta = g.latest_shift_delta ? parseFloat(g.latest_shift_delta) : null;
            return (
              <Link
                key={g.appid}
                href={`/game/${g.appid}`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-bg-secondary/60 transition-colors border-b border-border-default/40 last:border-b-0"
              >
                {/* 방향 배지 */}
                <span className={`mt-0.5 flex-shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded ${
                  isDecline
                    ? "bg-accent-red/15 text-accent-red"
                    : "bg-accent-green/15 text-accent-green"
                }`}>
                  {isDecline ? "📉 급락" : "📈 회복"}
                </span>
                {/* 게임명 + 변화폭 */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{g.name_kr || g.name}</p>
                  {delta !== null && (
                    <p className={`text-[10px] font-semibold mt-0.5 ${
                      isDecline ? "text-accent-red" : "text-accent-green"
                    }`}>
                      {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}pp
                    </p>
                  )}
                </div>
                {/* 날짜 */}
                <span className="text-[10px] text-text-muted flex-shrink-0 mt-0.5">
                  {fmtRelative(g.latest_shift_date)}
                </span>
              </Link>
            );
          })
        )}
      </div>

      {/* ── 🔔 이벤트 감지 ──────────────────────────────────────────── */}
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">🔔 이벤트 감지</h3>
      </div>

      <div>
        {eventGames.length === 0 ? (
          <p className="px-4 py-4 text-xs text-text-muted text-center">최근 30일 내 이벤트 없음</p>
        ) : (
          eventGames.map((g) => (
            <Link
              key={g.appid}
              href={`/game/${g.appid}`}
              className="flex items-start gap-3 px-4 py-3 hover:bg-bg-secondary/60 transition-colors border-b border-border-default/40 last:border-b-0"
            >
              {/* 뉴스/업데이트 아이콘 */}
              <span className="mt-0.5 flex-shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue">
                🔧 업데이트
              </span>
              {/* 게임명 + 이벤트 제목 */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{g.name_kr || g.name}</p>
                {g.latest_official_event_title && (
                  <p className="text-[10px] text-text-muted truncate mt-0.5">
                    {g.latest_official_event_title}
                  </p>
                )}
              </div>
              {/* 날짜 */}
              <span className="text-[10px] text-text-muted flex-shrink-0 mt-0.5">
                {fmtRelative(g.latest_official_event_date)}
              </span>
            </Link>
          ))
        )}
      </div>

      {/* ── 📊 긍정률 TOP ───────────────────────────────────────────── */}
      {rateGames.length > 0 && (
        <>
          <div className="px-4 py-3">
            <h3 className="text-sm font-semibold text-text-primary">📊 긍정률 TOP</h3>
          </div>
          <div className="px-4 py-3 space-y-2.5">
            {rateGames.map((game, idx) => {
              const rate = Number(game.steam_positive_rate);
              const barColor =
                rate >= 80 ? "bg-accent-green" :
                rate >= 60 ? "bg-accent-yellow" :
                "bg-accent-red";
              const rateColor =
                rate >= 80 ? "text-accent-green" :
                rate >= 60 ? "text-accent-yellow" :
                "text-accent-red";
              return (
                <Link
                  key={game.appid}
                  href={`/game/${game.appid}`}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity group"
                >
                  <span className="text-[10px] text-text-muted w-3 text-right flex-shrink-0">{idx + 1}</span>
                  <p className="text-xs text-text-primary truncate flex-1 group-hover:text-accent-blue transition-colors">
                    {game.name_kr || game.name}
                  </p>
                  <div className="w-14 h-1.5 rounded-full bg-bg-secondary flex-shrink-0">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${Math.min(rate, 100)}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-semibold ${rateColor} w-8 text-right tabular-nums flex-shrink-0`}>
                    {rate.toFixed(0)}%
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}

    </div>
  );
}
