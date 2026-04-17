/**
 * POST /api/admin/retry-pool
 *
 * error_pool_empty 상태인 게임을 collecting으로 되돌립니다.
 * 관리자가 Sheet_Pool 탭에 새 시트를 추가한 후 호출해야 합니다.
 *
 * 다음 GitHub Actions 수집 실행 시 해당 게임이 자동으로 풀에서
 * 시트를 할당받아 수집을 재개합니다.
 */
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
      // collecting으로 되돌림 → 다음 Actions 실행 시 Sheet_Pool에서 재할당 시도
      await updateGame(String(appid), { status: "collecting" } as never);
    } catch (updateErr) {
      const msg = String(updateErr);
      if (msg.includes("not found")) {
        // 이미 삭제된 게임 — 정상으로 처리
        return NextResponse.json({ ok: true });
      }
      throw updateErr;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
