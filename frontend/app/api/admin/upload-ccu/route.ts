import { NextRequest, NextResponse } from "next/server";
import { getConfig, getGame, getCcuData, appendCcuRows } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const appid = formData.get("appid") as string;
    const password = formData.get("password") as string;
    const file = formData.get("file") as File;

    if (!appid || !password || !file) {
      return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
    }

    const [config, game] = await Promise.all([getConfig(), getGame(appid)]);
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const gameSheetId = game?.game_sheet_id;

    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);

    // 구분자 자동 감지 (탭 우선, 없으면 쉼표)
    const delimiter = lines[0]?.includes("\t") ? "\t" : ",";

    // CSV/TSV 파싱
    // 지원 형식:
    //   SteamDB CSV  : DateTime,Players
    //   내부 TSV     : timestamp\tccu_value\tis_sale_period\tis_free_weekend\tis_archived_gap
    const existing = await getCcuData(appid, gameSheetId);
    const existingTimestamps = new Set(existing.map((r) => String(r.timestamp)));

    const newRows: string[][] = [];
    for (const line of lines.slice(1)) {
      const parts = line.split(delimiter);
      if (parts.length < 2) continue;
      const ts  = parts[0].trim().replace(/"/g, "");
      const val = parts[1].trim().replace(/"/g, "");
      if (!ts || !val || isNaN(Number(val)) || existingTimestamps.has(ts)) continue;
      // 5컬럼 포맷이면 나머지 컬럼도 그대로 사용, 아니면 false로 채움
      const salePeriod   = (parts[2]?.trim().replace(/"/g, "").toLowerCase() || "false");
      const freeWeekend  = (parts[3]?.trim().replace(/"/g, "").toLowerCase() || "false");
      const archivedGap  = (parts[4]?.trim().replace(/"/g, "").toLowerCase() || "false");
      newRows.push([ts, val, salePeriod, freeWeekend, archivedGap]);
    }

    if (newRows.length > 0) {
      await appendCcuRows(appid, newRows, gameSheetId);
    }

    return NextResponse.json({ ok: true, added: newRows.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
