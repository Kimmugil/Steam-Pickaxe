import Link from "next/link";
import type { Game } from "@/types";
import RateSection from "./RateSection";
import EventSection from "./EventSection";

interface Props {
  games: Game[];
}

function daysSince(d: string | undefined) {
  if (!d) return 9999;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

export default async function HomeInsightPanel({ games }: Props) {

  function fmtRelative(d: string | undefined): string {
    if (!d) return "";
    const n = daysSince(d);
    if (n === 0) return "오늘";
    if (n <= 7)  return `${n}일 전`;
    if (n <= 30) return `${Math.ceil(n / 7)}주 전`;
    return              `${Math.ceil(n / 30)}개월 전`;
  }

  // ── 평가 급변 목록 (최근 60일) ───────────────────────────────────────────────
  const shiftGames = games
    .filter(g => g.latest_shift_date && daysSince(g.latest_shift_date) <= 60)
    .sort((a, b) => (b.latest_shift_date ?? "").localeCompare(a.latest_shift_date ?? ""));

  // ── 이벤트 감지 목록 (최근 14일) ─────────────────────────────────────────────
  const eventGames = games
    .filter(g => g.latest_official_event_date && daysSince(g.latest_official_event_date) <= 14)
    .sort((a, b) => (b.latest_official_event_date ?? "").localeCompare(a.latest_official_event_date ?? ""));

  // ── 긍정률 목록 ──────────────────────────────────────────────────────────────
  const rateGames = [...games].filter(g => Number(g.steam_positive_rate) > 0);

  return (
    <div className="bg-bg-card border border-border-default rounded-2xl overflow-hidden divide-y divide-border-default shadow-2xl shadow-black/50 ring-1 ring-white/5">

      {/* ── ⚡ 평가 급변 ─────────────────────────────────────────────── */}
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">{"⚡ 평가 급변"}</h3>
      </div>
      <div>
        {shiftGames.length === 0 ? (
          <p className="px-4 py-4 text-xs text-text-muted text-center">{"최근 60일 내 급변 없음"}</p>
        ) : (
          shiftGames.map((g) => {
            const isDecline = g.latest_shift_direction === "decline";
            const delta = g.latest_shift_delta ? parseFloat(g.latest_shift_delta) : null;
            const shiftYm = g.latest_shift_date?.slice(0, 7) ?? "";
            return (
              <Link
                key={g.appid}
                href={`/game/${g.appid}${shiftYm ? `?ym=${shiftYm}&tab=shift` : ""}`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-bg-secondary/60 transition-colors border-b border-border-default/40 last:border-b-0"
              >
                <span className={`mt-0.5 flex-shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded ${
                  isDecline ? "bg-accent-red/15 text-accent-red" : "bg-accent-green/15 text-accent-green"
                }`}>
                  {isDecline ? "📉 급락" : "📈 회복"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{g.name_kr || g.name}</p>
                  {delta !== null && (
                    <p className={`text-[10px] font-semibold mt-0.5 ${isDecline ? "text-accent-red" : "text-accent-green"}`}>
                      긍정률 {delta > 0 ? "+" : ""}{delta.toFixed(1)}%p 변화
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-text-muted flex-shrink-0 mt-0.5">
                  {fmtRelative(g.latest_shift_date)}
                </span>
              </Link>
            );
          })
        )}
      </div>

      {/* ── 🔔 이벤트 감지 (클라이언트 토글 포함) ──────────────────────── */}
      <EventSection games={eventGames} />

      {/* ── 📊 긍정률 (클라이언트 토글 포함) ──────────────────────────── */}
      {rateGames.length > 0 && <RateSection games={rateGames} />}

    </div>
  );
}
