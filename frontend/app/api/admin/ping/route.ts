import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/sheets";

/**
 * POST /api/admin/ping
 * 관리자 비밀번호를 검증합니다. 데이터 변경 없음.
 */
export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (!password) return NextResponse.json({ error: "비밀번호 필요" }, { status: 400 });
    const config = await getConfig();
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
