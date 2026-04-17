import SearchBox from "@/components/home/SearchBox";
import GameCard from "@/components/home/GameCard";
import QueueCardWrapper from "@/components/home/QueueCardWrapper";
import { getAllGames } from "@/lib/sheets";

export const revalidate = 60; // 60초마다 재검증

async function getGames() {
  try {
    return await getAllGames();
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const games = await getGames();
  const activeGames = games.filter((g) => g.status === "active");
  const collectingGames = games.filter((g) => g.status === "collecting");

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-10">
      {/* 헤더 */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          Steam 게임 마켓 인텔리전스
        </h1>
        <p className="text-text-secondary text-base">
          업데이트 민심 · 트래픽 · 언어권 반응을 한눈에 꿰뚫는 스팀 분석 대시보드
        </p>
      </div>

      {/* 검색 */}
      <SearchBox />

      {/* 수집 대기열 */}
      {collectingGames.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-accent-blue rounded-full animate-pulse" />
            데이터 수집 대기열
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collectingGames.map((game) => (
              <QueueCardWrapper key={String(game.appid)} game={game} />
            ))}
          </div>
        </section>
      )}

      {/* 분석 완료 게임 목록 */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          분석 완료된 게임
          <span className="ml-2 text-sm text-text-muted font-normal">{activeGames.length}개</span>
        </h2>
        {activeGames.length === 0 ? (
          <div className="text-center py-20 text-text-muted">
            <p className="text-4xl mb-4">🎮</p>
            <p>아직 등록된 게임이 없습니다.</p>
            <p className="text-sm mt-1">위 검색창에서 Steam 게임을 검색하고 등록해 보세요.</p>
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

