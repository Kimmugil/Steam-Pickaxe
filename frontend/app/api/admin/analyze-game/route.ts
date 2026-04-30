import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/sheets";

const GITHUB_TOKEN = process.env.GH_PAT!;
const GITHUB_REPO = process.env.GITHUB_REPO ?? "Kimmugil/Steam-Pickaxe";

/**
 * 게임별 타임라인 AI 분석 트리거
 * - year_month 없음 → 전체 타임라인 재분석 + 평가 급변 감지 (analyze-game.yml)
 * - year_month 있음 → 해당 월만 선택 재분석 (analyze-game.yml, 급변 감지 생략)
 */
export async function POST(req: NextRequest) {
  try {
    const { password, appid, year_month } = await req.json();
    if (!password) return NextResponse.json({ error: "비밀번호가 필요합니다." }, { status: 400 });
    if (!appid)    return NextResponse.json({ error: "appid가 필요합니다." }, { status: 400 });

    const config = await getConfig();
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub 토큰이 설정되지 않았습니다." }, { status: 500 });
    }

    const inputs: Record<string, string> = { appid: String(appid) };
    if (year_month) inputs.year_month = String(year_month);

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/analyze.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({ ref: "main", inputs }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `GitHub API ${res.status}: ${body}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
