import { NextRequest, NextResponse } from "next/server";
import { appendGame, getAllGames } from "@/lib/sheets";
import { getSteamReviewSummary } from "@/lib/steam";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_REPO = process.env.GITHUB_REPO ?? "Kimmugil/Steam-Pickaxe";

export async function POST(req: NextRequest) {
  try {
    const { appid, name, thumbnail } = await req.json();
    if (!appid) return NextResponse.json({ error: "appid required" }, { status: 400 });

    // 중복 확인
    const games = await getAllGames();
    const existing = games.find((g) => String(g.appid) === String(appid));
    if (existing && existing.status !== "archived") {
      return NextResponse.json({ error: "already_registered", appid });
    }

    const reviewSummary = await getSteamReviewSummary(String(appid));
    const now = new Date().toISOString();

    await appendGame({
      appid: String(appid),
      name,
      name_kr: name,
      thumbnail,
      status: "collecting",
      collection_started_at: now,
      last_cursor: "*",
      total_reviews_count: reviewSummary.total,
      collected_reviews_count: 0,
      totalReviews: reviewSummary.total,
    });

    // GitHub Actions 수집 트리거
    if (GITHUB_TOKEN) {
      await triggerGitHubAction("register-game", { appid: String(appid) });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

async function triggerGitHubAction(eventType: string, payload: Record<string, string>) {
  await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({ event_type: eventType, client_payload: payload }),
  });
}
