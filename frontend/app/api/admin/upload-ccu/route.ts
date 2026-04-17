import { NextRequest, NextResponse } from "next/server";
import { getConfig, getCcuData, appendCcuRows } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const appid = formData.get("appid") as string;
    const password = formData.get("password") as string;
    const file = formData.get("file") as File;

    if (!appid || !password || !file) {
      return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
    }

    const config = await getConfig();
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);
    const header = lines[0].toLowerCase();

    // CSV 파싱 (SteamDB 형식: DateTime,Players 또는 timestamp,ccu_value)
    const existing = await getCcuData(appid);
    const existingTimestamps = new Set(existing.map((r) => String(r.timestamp)));

    const newRows: string[][] = [];
    for (const line of lines.slice(1)) {
      const parts = line.split(",");
      if (parts.length < 2) continue;
      const ts = parts[0].trim().replace(/"/g, "");
      const val = parts[1].trim().replace(/"/g, "");
      if (!ts || !val || existingTimestamps.has(ts)) continue;
      newRows.push([ts, val, "false", "false", "false"]);
    }

    if (newRows.length > 0) {
      await appendCcuRows(appid, newRows);
    }

    return NextResponse.json({ ok: true, added: newRows.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
