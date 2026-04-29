import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getGame } from "@/lib/sheets";

// 플레이타임 구간 (단위: 분)
const NEW_MAX   = 120;    // < 2시간
const HEAVY_MIN = 6000;   // >= 100시간

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ appid: string }> }
) {
  try {
    const { appid } = await params;

    // 게임 시트 ID 조회
    const game = await getGame(appid);
    if (!game?.game_sheet_id) {
      return NextResponse.json({ error: "게임을 찾을 수 없습니다." }, { status: 404 });
    }

    // Sheets 클라이언트
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    // reviews_* 탭 목록 조회
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: game.game_sheet_id,
    });
    const reviewTabs = (meta.data.sheets ?? [])
      .map((s) => s.properties?.title ?? "")
      .filter((t) => t.startsWith("reviews_"));

    if (!reviewTabs.length) {
      return NextResponse.json({ segments: null, total: 0 });
    }

    // voted_up (B열) + playtime_at_review (F열) 배치 읽기
    const ranges = reviewTabs.flatMap((tab) => [
      `'${tab}'!B2:B`,
      `'${tab}'!F2:F`,
    ]);

    const batchRes = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: game.game_sheet_id,
      ranges,
    });
    const valueRanges = batchRes.data.valueRanges ?? [];

    const seg = {
      new:   { total: 0, positive: 0 },
      mid:   { total: 0, positive: 0 },
      heavy: { total: 0, positive: 0 },
    };

    // 2개씩 쌍으로 처리: [B-tab0, F-tab0, B-tab1, F-tab1, ...]
    for (let i = 0; i < valueRanges.length; i += 2) {
      const bVals = valueRanges[i]?.values ?? [];
      const fVals = valueRanges[i + 1]?.values ?? [];
      const len = Math.max(bVals.length, fVals.length);

      for (let j = 0; j < len; j++) {
        const rawVoted  = (bVals[j]?.[0] ?? "").toString().toUpperCase();
        const playtime  = parseInt(fVals[j]?.[0] ?? "0") || 0;
        const isPositive = rawVoted === "TRUE";

        const bucket: "new" | "mid" | "heavy" =
          playtime < NEW_MAX ? "new" :
          playtime >= HEAVY_MIN ? "heavy" : "mid";

        seg[bucket].total++;
        if (isPositive) seg[bucket].positive++;
      }
    }

    const toStat = (s: { total: number; positive: number }) => ({
      total: s.total,
      positive: s.positive,
      rate: s.total > 0 ? Math.round((s.positive / s.total) * 100) : 0,
    });

    return NextResponse.json({
      segments: {
        new:   toStat(seg.new),
        mid:   toStat(seg.mid),
        heavy: toStat(seg.heavy),
      },
      total: seg.new.total + seg.mid.total + seg.heavy.total,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
