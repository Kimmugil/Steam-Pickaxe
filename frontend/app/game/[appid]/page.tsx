import { notFound, redirect } from "next/navigation";
import { getGame, getTimeline, getCcuData, getAllGames } from "@/lib/sheets";
import DashboardClient from "./DashboardClient";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ appid: string }>;
}

export default async function GamePage({ params }: PageProps) {
  const { appid } = await params;

  const game = await getGame(appid);

  const [timelineRows, ccuRows, allGames] = await Promise.all([
    getTimeline(appid, game?.game_sheet_id),
    getCcuData(appid, game?.game_sheet_id),
    getAllGames(),
  ]);

  if (!game) notFound();
  if (game.status === "collecting") {
    redirect("/");
  }

  // 최신 CCU
  const sortedCcu = [...ccuRows].sort((a, b) =>
    String(b.timestamp).localeCompare(String(a.timestamp))
  );
  const currentCcu = sortedCcu.length > 0 ? Number(sortedCcu[0].ccu_value) : undefined;

  // 최신 전체 긍정률
  const allRows = timelineRows.filter(
    (r) =>
      r.language_scope === "all" &&
      r.event_type !== "news" &&
      r.sentiment_rate !== "" &&
      r.sentiment_rate !== "sparse" &&
      !isNaN(Number(r.sentiment_rate))
  );
  allRows.sort((a, b) => b.date.localeCompare(a.date));
  const topSentimentRate = allRows.length > 0 ? Number(allRows[0].sentiment_rate) : undefined;

  // top_languages 파싱
  const topLanguages = game.top_languages
    ? game.top_languages.split(",").map((l) => l.trim()).filter(Boolean)
    : [];

  return (
    <DashboardClient
      game={game}
      timelineRows={timelineRows}
      ccuRows={ccuRows}
      allGames={allGames}
      currentCcu={currentCcu}
      topSentimentRate={topSentimentRate}
      topLanguages={topLanguages}
    />
  );
}
