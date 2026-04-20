import AdminPanel from "@/components/admin/AdminPanel";
import { getAllGames } from "@/lib/sheets";

export const revalidate = 30;

export default async function AdminPage() {
  let games: Awaited<ReturnType<typeof getAllGames>> = [];
  try {
    games = await getAllGames();
  } catch {}

  const collectingGames = games.filter(
    (g) => g.status === "collecting" || g.status === "error_pool_empty"
  );

  // AI 분석 승인 대기: active 상태이면서 ai_briefing 없고 ai_approved 미설정인 게임
  const pendingAiGames = games.filter(
    (g) =>
      g.status === "active" &&
      !String(g.ai_briefing ?? "").trim() &&
      String(g.ai_approved ?? "").toLowerCase() !== "true"
  );

  const activeGames = games.filter((g) => g.status === "active");

  return <AdminPanel collectingGames={collectingGames} pendingAiGames={pendingAiGames} activeGames={activeGames} />;
}
