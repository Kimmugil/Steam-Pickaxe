import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/sheets";

const GITHUB_TOKEN = process.env.GH_PAT!;
const GITHUB_REPO = process.env.GITHUB_REPO ?? "Kimmugil/Steam-Pickaxe";

/**
 * POST /api/admin/retrigger-collect
 * collect.yml 워크플로우를 수동으로 트리거합니다.
 * 수집 실패로 대기열에 남은 게임들을 재시작할 때 사용합니다.
 *
 * Body: { password: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    const config = await getConfig();
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "GH_PAT 환경변수가 설정되지 않았습니다." }, { status: 500 });
    }

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/collect.yml/dispatches`,
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

    // GitHub는 성공 시 204 No Content를 반환함
    if (res.status === 204 || res.ok) {
      return NextResponse.json({ ok: true });
    }

    const text = await res.text();
    return NextResponse.json({ error: `GitHub API 오류: ${res.status} ${text}` }, { status: 500 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
