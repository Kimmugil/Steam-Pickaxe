import { NextRequest, NextResponse } from "next/server";
import { getConfig, getAllGames, getTimeline, updateGame, ensureGamesColumn } from "@/lib/sheets";

export const maxDuration = 300; // Vercel Pro: 5분

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (!password) return NextResponse.json({ error: "비밀번호가 필요합니다." }, { status: 400 });

    const config = await getConfig();
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    // 컬럼이 없으면 먼저 생성 (없으면 updateGame이 조용히 스킵함)
    await ensureGamesColumn("latest_official_event_url");

    const games = await getAllGames();
    const results: { appid: string; name: string; status: string; url?: string }[] = [];

    for (const game of games) {
      const appid = String(game.appid ?? "");
      const name  = String(game.name_kr || game.name || appid);

      // 이미 값이 있으면 스킵
      if (game.latest_official_event_url) {
        results.push({ appid, name, status: "skipped" });
        continue;
      }

      if (!game.game_sheet_id) {
        results.push({ appid, name, status: "no_sheet" });
        continue;
      }

      try {
        const rows = await getTimeline(appid, String(game.game_sheet_id));

        const officials = rows.filter(
          (r) => r.event_type === "official" && r.date
        );

        if (officials.length === 0) {
          results.push({ appid, name, status: "no_event" });
          continue;
        }

        const latest = officials.reduce((a, b) =>
          (a.date ?? "") > (b.date ?? "") ? a : b
        );

        const url = String(latest.url ?? "").trim();
        if (!url) {
          results.push({ appid, name, status: "no_url" });
          continue;
        }

        await updateGame(appid, { latest_official_event_url: url });
        results.push({ appid, name, status: "updated", url });
      } catch (e) {
        results.push({ appid, name, status: `error: ${String(e)}` });
      }
    }

    const updated  = results.filter((r) => r.status === "updated").length;
    const skipped  = results.filter((r) => r.status === "skipped").length;
    const noEvent  = results.filter((r) => r.status === "no_event" || r.status === "no_url").length;

    return NextResponse.json({ ok: true, updated, skipped, noEvent, results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
