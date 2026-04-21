import SearchBox from "@/components/home/SearchBox";
import GameCard from "@/components/home/GameCard";
import PendingGameCard from "@/components/home/PendingGameCard";
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
    HOME_TITLE: "Steam 게임 마켓 인텔리전스",
    HOME_SUBTITLE: "업데이트 민심 · 트래픽 · 언어권 반응을 한눈에 꿰뚫는 스팀 분석 대시보드",
    GAMES_SECTION_TITLE: "분석 완료된 게임",
    GAMES_EMPTY_ICON: "🎮",
    GAMES_EMPTY_TITLE: "아직 등록된 게임이 없습니다.",
    GAMES_EMPTY_SUBTITLE: "위 검색창에서 Steam 게임을 검색하고 등록해 보세요.",
    SEARCH_SECTION_TITLE: "게임 등록",
  };
  const t = (key: string) => (uiText as Record<string, string>)[key] ?? FALLBACK[key] ?? key;

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-10 space-y-12">
      {/* ── 히어로 타이틀 ────────────────────────────────────────── */}
      <section className="text-center">
        <p className="text-2xl font-semibold text-text-primary">{t("HOME_SUBTITLE")}</p>
      </section>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeGames.map((game) => (
              <GameCard key={game.appid} game={game} />
            ))}
          </div>
        )}
      </section>

      {/* ── 분석 진행 중인 게임 ───────────────────────────────────── */}
      {pendingGames.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            분석 진행 중인 게임
            <span className="ml-2 text-sm text-text-muted font-normal">{pendingGames.length}개</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {pendingGames.map((game) => (
              <PendingGameCard key={String(game.appid)} game={game} />
            ))}
          </div>
        </section>
      )}

      {/* ── 게임 등록 검색 ────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-text-primary mb-4">{t("SEARCH_SECTION_TITLE")}</h2>
        <div className="max-w-2xl">
          <SearchBox />
        </div>
      </section>
    </div>
  );
}
