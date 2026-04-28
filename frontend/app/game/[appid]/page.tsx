import { notFound, redirect } from "next/navigation";
import { getGame, getTimelineCached, getCcuDataCached } from "@/lib/sheets";
import DashboardClient from "./DashboardClient";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ appid: string }>;
}

export default async function GamePage({ params }: PageProps) {
  const { appid } = await params;

  let game, timelineRows, ccuRows;
  try {
    game = await getGame(appid);

    if (!game) notFound();
    if (game.status === "collecting") redirect("/");

    const sheetId = game.game_sheet_id ?? "";
    [timelineRows, ccuRows] = await Promise.all([
      getTimelineCached(appid, sheetId),
      getCcuDataCached(appid, sheetId),
    ]);
  } catch (err: unknown) {
    // Google Sheets 쿼터 초과(429) — crash 대신 안내 페이지 렌더링
    const code =
      (err as { status?: number })?.status ??
      (err as { code?: number })?.code;
    if (code === 429) {
      return (
        <div className="min-h-screen bg-bg-primary flex items-center justify-center">
          <div className="max-w-md text-center px-6">
            <p className="text-4xl mb-4">⏳</p>
            <h1 className="text-xl font-semibold text-text-primary mb-2">
              데이터 로드 중 잠시 대기가 필요합니다
            </h1>
            <p className="text-sm text-text-muted mb-6">
              Google Sheets API 요청 한도에 잠시 도달했어요.
              <br />
              1~2분 후 새로고침하면 정상적으로 표시됩니다.
            </p>
            <a
              href={`/game/${appid}`}
              className="inline-block px-4 py-2 rounded-lg bg-accent-blue/20 border border-accent-blue/40 text-accent-blue text-sm hover:bg-accent-blue/30 transition-colors"
            >
              새로고침
            </a>
          </div>
        </div>
      );
    }
    throw err; // 다른 에러는 Next.js error boundary로 위임
  }

  // 최신 CCU
  const sortedCcu = [...(ccuRows ?? [])].sort((a, b) =>
    String(b.timestamp).localeCompare(String(a.timestamp))
  );
  const currentCcu = sortedCcu.length > 0 ? Number(sortedCcu[0].ccu_value) : undefined;

  // 최신 전체 긍정률
  const allRows = (timelineRows ?? []).filter(
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
  const topLanguages = game!.top_languages
    ? game!.top_languages.split(",").map((l) => l.trim()).filter(Boolean)
    : [];

  return (
    <DashboardClient
      game={game!}
      timelineRows={timelineRows ?? []}
      ccuRows={ccuRows ?? []}
      currentCcu={currentCcu}
      topSentimentRate={topSentimentRate}
      topLanguages={topLanguages}
    />
  );
}
