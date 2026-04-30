import SearchBox from "@/components/home/SearchBox";
import GameTable from "@/components/home/GameTable";
import PendingGameCard from "@/components/home/PendingGameCard";
import InsightSection from "@/components/home/InsightSection";
import { getAllGames, getUiText } from "@/lib/sheets";

export const revalidate = 60;

async function getGames() {
  try { return await getAllGames(); } catch { return []; }
}

export default async function HomePage() {
  const [games, uiText] = await Promise.all([getGames(), getUiText()]);

  const activeGames = games
    .filter((g) => g.status === "active")
    .sort((a, b) => {
      const ao = Number(a.sort_order) || 9999;
      const bo = Number(b.sort_order) || 9999;
      return ao - bo;
    });
  const pendingGames = games.filter(
    (g) => g.status === "collecting" || g.status === "error_pool_empty"
  );

  const FALLBACK: Record<string, string> = {
    HOME_TITLE: "🌾 스팀 정미소",
    HOME_SUBTITLE: "업데이트 민심 · 트래픽 · 언어권 반응을 한눈에 꿰뚫는 스팀 분석 대시보드",
    GAMES_SECTION_TITLE: "분석 완료된 게임",
    GAMES_EMPTY_ICON: "🎮",
    GAMES_EMPTY_TITLE: "아직 등록된 게임이 없습니다.",
    GAMES_EMPTY_SUBTITLE: "위 검색창에서 Steam 게임을 검색하고 등록해 보세요.",
    SEARCH_SECTION_TITLE: "게임 등록",
    PENDING_GAMES_SECTION_TITLE: "분석 진행 중인 게임",
    KPI_GAMES_LABEL:   "분석 완료",
    KPI_SHIFTS_LABEL:  "최근 급변",
    KPI_UPDATES_LABEL: "최근 업데이트",
    KPI_AVG_RATE_LABEL: "평균 긍정률",
  };
  const t = (key: string) => (uiText as Record<string, string>)[key] ?? FALLBACK[key] ?? key;

  // ── KPI 계산 ──────────────────────────────────────────────────────────────
  const now = Date.now();
  const daysSince = (d: string | undefined) =>
    d ? Math.floor((now - new Date(d).getTime()) / 86400000) : 9999;

  const kpiShifts  = activeGames.filter(g => g.latest_shift_date  && daysSince(g.latest_shift_date)  <= 60).length;
  const kpiUpdates = activeGames.filter(g => g.latest_official_event_date && daysSince(g.latest_official_event_date) <= 21).length;
  const ratedGames = activeGames.filter(g => Number(g.steam_positive_rate) > 0);
  const kpiAvgRate = ratedGames.length > 0
    ? Math.round(ratedGames.reduce((s, g) => s + Number(g.steam_positive_rate), 0) / ratedGames.length)
    : null;

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-10 space-y-12">
      {/* ── 히어로 + 게임 등록 ───────────────────────────────────── */}
      <section className="text-center space-y-6">
        <p className="text-2xl font-semibold text-text-primary">{t("HOME_TITLE")}</p>
        <div className="max-w-2xl mx-auto">
          <SearchBox />
        </div>
      </section>

      {/* ── KPI 지표 행 ────────────────────────────────────────────────────── */}
      {activeGames.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("KPI_GAMES_LABEL"),    value: `${activeGames.length}개` },
            { label: t("KPI_SHIFTS_LABEL"),   value: kpiShifts  > 0 ? `${kpiShifts}개`  : "—" },
            { label: t("KPI_UPDATES_LABEL"),  value: kpiUpdates > 0 ? `${kpiUpdates}개` : "—" },
            { label: t("KPI_AVG_RATE_LABEL"), value: kpiAvgRate !== null ? `${kpiAvgRate}%` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-bg-card border border-border-default rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-text-muted mb-1">{label}</p>
              <p className="text-xl font-bold text-text-primary">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── 인사이트 섹션 ────────────────────────────────────────── */}
      {activeGames.length > 0 && (
        <InsightSection games={activeGames} uiText={uiText as Record<string, string>} />
      )}

      {/* ── 분석 완료된 게임 ──────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          {t("GAMES_SECTION_TITLE")}
          <span className="ml-2 text-sm text-text-muted font-normal">{activeGames.length}개</span>
        </h2>
        {activeGames.length === 0 ? (
          <div className="text-center py-20 text-text-muted">
            <p className="text-4xl mb-4">{t("GAMES_EMPTY_ICON")}</p>
            <p>{t("GAMES_EMPTY_TITLE")}</p>
            <p className="text-sm mt-1">{t("GAMES_EMPTY_SUBTITLE")}</p>
          </div>
        ) : (
          <GameTable games={activeGames} />
        )}
      </section>

      {/* ── 분석 진행 중인 게임 ───────────────────────────────────── */}
      {pendingGames.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            {t("PENDING_GAMES_SECTION_TITLE")}
            <span className="ml-2 text-sm text-text-muted font-normal">{pendingGames.length}개</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {pendingGames.map((game) => (
              <PendingGameCard key={String(game.appid)} game={game} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
