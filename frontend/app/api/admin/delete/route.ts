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

    await updateGame(String(appid), { status: "archived" } as never);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
