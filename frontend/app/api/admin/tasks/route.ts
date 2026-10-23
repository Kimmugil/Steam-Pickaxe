import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/admin-actions";
import { sql } from "@/lib/db";

/** 막힌 분석 작업: 다시 시도(기록을 지워 다음 실행에서 새로 시도) 또는 건너뛰기(앞으로 계속 건너뜀) */
export async function POST(req: NextRequest) {
  const denied = await guard(); if (denied) return denied;
  const { appid, kind, period_key, scope, action } = await req.json().catch(() => ({}));
  if (!Number.isInteger(appid) || typeof kind !== "string") return NextResponse.json({ error: "작업 정보가 올바르지 않습니다." }, { status: 400 });
  const pk = String(period_key ?? ""), sc = String(scope ?? "all");
  if (action === "reset") {
    await sql`delete from analysis_tasks where appid = ${appid} and kind = ${kind} and period_key = ${pk} and scope = ${sc}`;
    return NextResponse.json({ ok: true, message: "다음 분석 실행에서 다시 시도합니다." });
  }
  if (action === "skip") {
    await sql`update analysis_tasks set status = 'skipped', updated_at = now() where appid = ${appid} and kind = ${kind} and period_key = ${pk} and scope = ${sc}`;
    return NextResponse.json({ ok: true, message: "이 항목은 건너뜁니다. 이전 결과는 그대로 보입니다." });
  }
  return NextResponse.json({ error: "알 수 없는 동작입니다." }, { status: 400 });
}
