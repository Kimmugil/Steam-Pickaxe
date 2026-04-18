import SearchBox from "@/components/home/SearchBox";
import GameCard from "@/components/home/GameCard";
import QueueCardWrapper from "@/components/home/QueueCardWrapper";
import QueueRetriggerButton from "@/components/home/QueueRetriggerButton";
import { getAllGames, getUiText } from "@/lib/sheets";

export const revalidate = 60;

async function getGames() {
  try {
    return await getAllGames();
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [games, uiText] = await Promise.all([getGames(), getUiText()]);

  const activeGames = games.filter((g) => g.status === "active");
  // error_pool_empty도 대기열에 표시 (관리자가 재시도 버튼 사용 가능)
  const collectingGames = games.filter(
    (g) => g.status === "collecting" || g.status === "error_pool_empty"
  );

  const t = (key: string) => uiText[key] ?? key;

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-10">

      {/* ── 헤더 ──────────────────────────────────────────────────────── */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          {t("HOME_TITLE")}
        </h1>
        <p className="text-text-secondary text-base">{t("HOME_SUBTITLE")}</p>
      </div>

      {/* ── 검색창 ────────────────────────────────────────────────────── */}
      <SearchBox />

      {/* ── 수집 대기열 (비어있으면 완전히 숨김) ─────────────────────── */}
      {collectingGames.length > 0 && (
        <section className="mt-12">
          {/* 시각적으로 구분된 "작업장" 컨테이너 */}
          <div className="border border-dashed border-border-default rounded-2xl p-5 bg-bg-secondary">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <span className="w-2 h-2 bg-accent-blue rounded-full animate-pulse" />
                {t("QUEUE_SECTION_TITLE")}
                <span className="ml-1 text-xs font-normal text-text-muted">
                  {collectingGames.length}개 처리 중
                </span>
              </h2>
              <QueueRetriggerButton />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {collectingGames.map((game) => (
                <QueueCardWrapper key={String(game.appid)} game={game} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 분석 완료 게임 목록 ───────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          {t("GAMES_SECTION_TITLE")}
          <span className="ml-2 text-sm text-text-muted font-normal">
            {activeGames.length}개
          </span>
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
    </div>
  );
}
