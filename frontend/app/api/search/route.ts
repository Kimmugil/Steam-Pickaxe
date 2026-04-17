import { NextRequest, NextResponse } from "next/server";
import { searchSteamGame, getSteamReviewSummary } from "@/lib/steam";
import { getAllGames } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q) return NextResponse.json({ error: "query required" }, { status: 400 });

  try {
    const result = await searchSteamGame(q);
    if (!result) return NextResponse.json({});

    // 이미 등록된 게임인지 확인
    const games = await getAllGames();
    const existing = games.find((g) => String(g.appid) === String(result.appid));
    if (existing && existing.status !== "archived") {
      return NextResponse.json({ error: "already_registered", appid: result.appid });
    }

    // 게임 타입 확인
    if (result.type && result.type !== "game" && result.type !== "unknown") {
      return NextResponse.json({ error: "not_game" });
    }

    // 리뷰 요약
    const reviewSummary = await getSteamReviewSummary(result.appid);

    return NextResponse.json({
      ...result,
      totalReviews: reviewSummary.total,
      positiveRate: reviewSummary.rate,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
