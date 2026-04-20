import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/sheets";

const GITHUB_TOKEN = process.env.GH_PAT!;
const GITHUB_REPO  = process.env.GITHUB_REPO ?? "Kimmugil/Steam-Pickaxe";

export async function POST(req: NextRequest) {
  try {
    const { password, appid } = await req.json();
    if (!password) return NextResponse.json({ error: "비밀번호가 필요합니다." }, { status: 400 });
    if (!appid)    return NextResponse.json({ error: "appid가 필요합니다." },    { status: 400 });

    const config = await getConfig();
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub 토큰이 설정되지 않았습니다." }, { status: 500 });
    }

    // core-analyze-game 이벤트 → core-analyze.yml 트리거
    // CORE_ONLY=true 로 실행: 이벤트 수집 없이 4개 종합 분석만 실행
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          event_type: "core-analyze-game",
          client_payload: { appid: String(appid) },
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
