import { NextRequest, NextResponse } from "next/server";
import { getConfig, getAllGames, getTimeline } from "@/lib/sheets";

export const maxDuration = 300;

export interface AnomalyGame {
  appid: string;
  name: string;
  affectedMonths: { ym: string; rate: number; reviewCount: number }[];
}

/** 긍정률 99% 이상인 monthly_summary 구간이 있는 게임 목록 반환 */
export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (!password) return NextResponse.json({ error: "비밀번호가 필요합니다." }, { status: 400 });

    const config = await getConfig();
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const games = await getAllGames();
    const anomalies: AnomalyGame[] = [];

    for (const game of games) {
      const appid       = String(game.appid ?? "");
      const name        = String(game.name_kr || game.name || appid);
      const gameSheetId = String(game.game_sheet_id ?? "");
      if (!gameSheetId) continue;

      try {
        const rows = await getTimeline(appid, gameSheetId);
        const affected = rows
          .filter((r) => {
            if (r.event_type !== "monthly_summary") return false;
            if (r.language_scope !== "all") return false;
            const rate = Number(r.sentiment_rate);
            return !isNaN(rate) && rate >= 99;
          })
          .map((r) => ({
            ym:          String(r.date ?? "").slice(0, 7),
            rate:        Number(r.sentiment_rate),
            reviewCount: Number(r.review_count ?? 0),
          }))
          .filter((m) => m.ym)
          .sort((a, b) => a.ym.localeCompare(b.ym));

        if (affected.length > 0) {
          anomalies.push({ appid, name, affectedMonths: affected });
        }
      } catch {
        // 시트 읽기 실패 시 스킵
      }
    }

    return NextResponse.json({ ok: true, anomalies });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
