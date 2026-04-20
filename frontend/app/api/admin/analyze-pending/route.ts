import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/sheets";

const GITHUB_TOKEN = process.env.GH_PAT!;
const GITHUB_REPO = process.env.GITHUB_REPO ?? "Kimmugil/Steam-Pickaxe";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (!password) {
      return NextResponse.json({ error: "비밀번호가 필요합니다." }, { status: 400 });
    }

    const config = await getConfig();
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub 토큰이 설정되지 않았습니다." }, { status: 500 });
    }

    // analyze.yml을 workflow_dispatch로 직접 트리거.
    // 뉴스 재수집(main_collect.py) 없이 분석만 실행하며,
    // main_analyze.py 내부의 analyzed_ids 로직이 이미 분석된 이벤트를 자동으로 스킵한다.
    const res = await fetch(
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

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[analyze-pending] GitHub dispatch 실패:", res.status, errText);
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
