import { NextRequest, NextResponse } from "next/server";
import { getConfig, updateGame } from "@/lib/sheets";
import type { Game } from "@/types";

/**
 * POST /api/admin/approve-only
 * ai_approved 플래그만 "true"로 설정하고, 분석 워크플로우는 트리거하지 않습니다.
 * 리뷰 수집이 완료되지 않은 상태에서 승인만 해두고 싶을 때 사용합니다.
 * 이후 analyze.yml 월간 자동 실행 또는 재분석 버튼으로 분석을 실행하세요.
 *
 * Body: { password: string, appid: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { password, appid } = await req.json();
    if (!password) return NextResponse.json({ error: "비밀번호가 필요합니다." }, { status: 400 });
    if (!appid) return NextResponse.json({ error: "appid가 필요합니다." }, { status: 400 });

    const config = await getConfig();
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    await updateGame(String(appid), { ai_approved: "true" } as Partial<Game>);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
