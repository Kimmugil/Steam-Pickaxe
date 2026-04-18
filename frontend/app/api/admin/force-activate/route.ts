import { NextRequest, NextResponse } from "next/server";
import { getConfig, updateGame } from "@/lib/sheets";

const GITHUB_TOKEN = process.env.GH_PAT!;
const GITHUB_REPO = process.env.GITHUB_REPO ?? "Kimmugil/Steam-Pickaxe";

/**
 * POST /api/admin/force-activate
 * 리뷰 수집이 완료되지 않은 상태에서 강제로 active 전환 + analyze.yml 트리거.
 * 수집 중이지만 충분한 리뷰가 쌓인 경우 조기 분석 시작에 사용.
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

    // status → active, cursor 초기화 (이후 collect는 신규 리뷰만 추가)
    await updateGame(appid, {
      status: "active",
      last_cursor: "",
    } as never);

    // analyze.yml 트리거
    if (GITHUB_TOKEN) {
      await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/analyze.yml/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github+json",
          },
          body: JSON.stringify({ ref: "main" }),
        }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
