import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/sheets";

const GITHUB_TOKEN = process.env.GH_PAT!;
const GITHUB_REPO = process.env.GITHUB_REPO ?? "Kimmugil/Steam-Pickaxe";

/**
 * 출시 초기 주간 버킷 재분석 트리거
 * analyze-game.yml을 early_launch_only=true로 실행합니다.
 * 이미 월간 단위로 분석된 게임의 출시 초기 기간을 주간 단위로 세분화 재분석할 때 사용합니다.
 */
export async function POST(req: NextRequest) {
  try {
    const { password, appid } = await req.json();
    if (!password) return NextResponse.json({ error: "비밀번호가 필요합니다." }, { status: 400 });
    if (!appid)    return NextResponse.json({ error: "appid가 필요합니다." }, { status: 400 });

    const config = await getConfig();
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub 토큰이 설정되지 않았습니다." }, { status: 500 });
    }

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/analyze-game.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            appid: String(appid),
            year_month: "",
            early_launch_only: "true",
          },
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "GitHub Actions 트리거 실패. PAT 권한을 확인하세요." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
