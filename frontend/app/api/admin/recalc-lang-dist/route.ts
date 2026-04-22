import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/sheets";

const GITHUB_TOKEN = process.env.GH_PAT!;
const GITHUB_REPO  = process.env.GITHUB_REPO ?? "Kimmugil/Steam-Pickaxe";

/** 전체 active 게임 언어 분포 재집계 트리거 (recalc-lang-dist.yml) */
export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (!password) return NextResponse.json({ error: "비밀번호가 필요합니다." }, { status: 400 });

    const config = await getConfig();
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub 토큰이 설정되지 않았습니다." }, { status: 500 });
    }

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/recalc-lang-dist.yml/dispatches`,
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

    if (res.status === 204 || res.ok) return NextResponse.json({ ok: true });

    const text = await res.text();
    return NextResponse.json({ error: `GitHub API 오류: ${res.status} ${text}` }, { status: 500 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
