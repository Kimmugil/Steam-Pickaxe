import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/admin-actions";

const ALLOWED = ["collect.yml", "analyze.yml"];

/** GitHub Actions 작업을 지금 실행하도록 요청합니다. (토큰과 저장소 이름 환경변수가 있어야 동작) */
export async function POST(req: NextRequest) {
  const denied = await guard(); if (denied) return denied;
  const { workflow } = await req.json().catch(() => ({}));
  if (!ALLOWED.includes(workflow)) return NextResponse.json({ error: "알 수 없는 작업입니다." }, { status: 400 });
  const token = process.env.GH_PAT ?? process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPO ?? "Kimmugil/Steam-Pickaxe"; // 예전 설정(GH_PAT)을 그대로 재사용
  if (!token || !repo) return NextResponse.json({ ok: false, message: "자동 실행(GitHub)이 아직 연결되지 않았습니다. 연결 전에는 다음 정기 실행 때 점검·복구가 진행됩니다." });
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main" }),
  });
  if (r.status === 204) return NextResponse.json({ ok: true, message: "실행을 요청했습니다. 몇 분 안에 시작됩니다." });
  return NextResponse.json({ ok: false, message: `실행 요청에 실패했습니다 (코드 ${r.status}). 토큰 권한이나 만료를 확인해 주세요.` }, { status: 502 });
}
