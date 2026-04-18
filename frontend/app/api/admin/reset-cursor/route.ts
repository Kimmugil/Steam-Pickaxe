import { NextRequest, NextResponse } from "next/server";
import { getConfig, updateGame } from "@/lib/sheets";

/**
 * POST /api/admin/reset-cursor
 * 수집 cursor를 *로 초기화합니다.
 * 수집 Action 실패로 cursor는 앞으로 갔지만 RAW 시트에 데이터가 없는 경우 사용합니다.
 *
 * Body: { password: string, appid: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { password, appid } = await req.json();

    if (!appid) {
      return NextResponse.json({ error: "appid 필요" }, { status: 400 });
    }

    const config = await getConfig();
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    await updateGame(appid, {
      last_cursor: "*",
      collected_reviews_count: 0,
      status: "collecting",
    } as never);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
