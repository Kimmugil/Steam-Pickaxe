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

type FeedItem = {
  date: string;
  type: "shift" | "update";
  name: string;
  sub?: string;
  appid: string | number;
  isDecline?: boolean;
};

export default function HomeInsightPanel({ games }: Props) {
  // ── 활동 피드 조합 ──────────────────────────────────────────────────────────
  const feed: FeedItem[] = [];
  for (const g of games) {
    if (g.latest_shift_date) {
      feed.push({
        date: g.latest_shift_date,
        type: "shift",
        name: g.name_kr || g.name,
        isDecline: g.latest_shift_direction === "decline",
        appid: g.appid,
      });
    }
    if (g.latest_official_event_date) {
      feed.push({
        date: g.latest_official_event_date,
        type: "update",
        name: g.name_kr || g.name,
        sub: g.latest_official_event_title,
        appid: g.appid,
      });
    }
  }
  feed.sort((a, b) => b.date.localeCompare(a.date));
  const topFeed = feed.slice(0, 10);

  // ── 긍정률 TOP ──────────────────────────────────────────────────────────────
  const rateGames = [...games]
    .filter(g => Number(g.steam_positive_rate) > 0)
    .sort((a, b) => Number(b.steam_positive_rate) - Number(a.steam_positive_rate))
    .slice(0, 6);

  return (
    <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden divide-y divide-border-default">

      {/* ── 최근 활동 ─────────────────────────────────────────────────── */}
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">📋 최근 활동</h3>
      </div>

      <div>
        {topFeed.length === 0 ? (
          <p className="px-4 py-5 text-xs text-text-muted text-center">활동 내역이 없습니다.</p>
        ) : (
          topFeed.map((item, i) => (
            <Link
              key={`${item.appid}-${item.type}-${i}`}
              href={`/game/${item.appid}`}
              className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-bg-secondary/60 transition-colors border-b border-border-default/40 last:border-b-0"
            >
              {/* 아이콘 */}
              <span className="text-sm flex-shrink-0">
                {item.type === "shift"
                  ? (item.isDecline ? "📉" : "📈")
                  : "🔧"}
              </span>
              {/* 내용 */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{item.name}</p>
                <p className="text-[10px] text-text-muted truncate">
                  {item.type === "shift"
                    ? (item.isDecline ? "급락" : "회복")
                    : (item.sub || "업데이트")}
                </p>
              </div>
              {/* 날짜 */}
              <span className="text-[10px] text-text-muted flex-shrink-0">
                {fmtRelative(item.date)}
              </span>
            </Link>
          ))
        )}
      </div>

      {/* ── 긍정률 TOP ──────────────────────────────────────────────── */}
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
