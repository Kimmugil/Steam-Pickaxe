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

  const activeGames = games.filter((g) => g.status === "active");
  const pendingGames = games.filter(
    (g) => g.status === "collecting" || g.status === "error_pool_empty"
  );

  const t = (key: string) => (uiText as Record<string, string>)[key] ?? key;

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-10">
      {/* 헤더 */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-text-primary mb-2">{t("HOME_TITLE")}</h1>
        <p className="text-text-secondary text-base">{t("HOME_SUBTITLE")}</p>
      </div>

      {/* 검색창 */}
      <SearchBox />

      {/* 분석 완료된 게임 */}
      <section className="mt-12">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeGames.map((game) => (
              <GameCard key={game.appid} game={game} />
            ))}
          </div>
        )}
      </section>

      {/* 분석 진행 중인 게임 */}
      {pendingGames.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            분석 진행 중인 게임
            <span className="ml-2 text-sm text-text-muted font-normal">{pendingGames.length}개</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pendingGames.map((game) => (
              <PendingGameCard key={String(game.appid)} game={game} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
