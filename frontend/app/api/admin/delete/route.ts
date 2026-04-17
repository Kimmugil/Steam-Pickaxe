import { NextRequest, NextResponse } from "next/server";
import { getConfig, updateGame } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  try {
    const { appid, password } = await req.json();
    if (!appid || !password) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }

    const config = await getConfig();
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    try {
      await updateGame(String(appid), { status: "archived" } as never);
    } catch (updateErr) {
      // DB에서 이미 삭제된 경우 — UI와 상태 불일치 방지를 위해 성공으로 처리
      const msg = String(updateErr);
      if (msg.includes("not found")) {
        return NextResponse.json({ ok: true });
      }
      throw updateErr;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
