import GameCardGrid from "@/components/home/GameCardGrid";
import PendingGameCard from "@/components/home/PendingGameCard";
import HomeInsightPanel from "@/components/home/HomeInsightPanel";
import FloatingNav from "@/components/home/FloatingNav";
import FloatingRightPanel from "@/components/home/FloatingRightPanel";
import { getAllGames } from "@/lib/sheets";

export const revalidate = 60;

async function getGames() {
  try { return await getAllGames(); } catch { return []; }
}

export default async function HomePage() {
  const games = await getGames();

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

  return (
    <>
    <div className="max-w-screen-xl mx-auto px-6 py-10 space-y-8">

      {activeGames.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <p className="text-4xl mb-4">{"🎮"}</p>
          <p>{"아직 등록된 게임이 없습니다."}</p>
          <p className="text-sm mt-1">{"위 검색창에서 Steam 게임을 검색하고 등록해 보세요."}</p>
        </div>
      ) : (
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            {"전체 게임"}
            <span className="ml-2 font-normal text-text-muted">{activeGames.length}{"개"}</span>
          </h2>
          <GameCardGrid games={activeGames} />
        </div>
      )}

      {/* ── 분석 진행 중인 게임 ───────────────────────────────────────── */}
      {pendingGames.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            {"분석 진행 중인 게임"}
            <span className="ml-2 font-normal text-text-muted">{pendingGames.length}{"개"}</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {pendingGames.map((game) => (
              <PendingGameCard key={String(game.appid)} game={game} />
            ))}
          </div>
        </section>
      )}

      {/* ── 모바일 전용 좌측 플로팅 버튼 ────────────────────────────── */}
      <FloatingNav />

    </div>

    {/* ── 데스크탑 우측 플로팅 패널 (등록 버튼 + 인사이트) ──────────── */}
    {activeGames.length > 0 && (
      <FloatingRightPanel>
        <HomeInsightPanel games={activeGames} />
      </FloatingRightPanel>
    )}
    </>
  );
}
