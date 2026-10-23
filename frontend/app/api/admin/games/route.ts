import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { addGame, guard } from "@/lib/admin-actions";
import { sql } from "@/lib/db";
import { parseAppId } from "@/lib/steam";

/** 게임 추가 */
export async function POST(req: NextRequest) {
  const denied = await guard(); if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const appid = typeof b.appid === "number" ? b.appid : parseAppId(String(b.appid ?? ""));
  if (!appid) return NextResponse.json({ error: "AppID가 올바르지 않습니다." }, { status: 400 });
  const months = [0, 6, 12].includes(Number(b.aiMonths)) ? Number(b.aiMonths) : 6;
  const r = await addGame(appid, months);
  revalidatePath("/");
  return NextResponse.json(r, { status: r.ok ? 200 : 404 });
}

/** 수집 단계 고정·해제, 보관·복원, AI 분석 켜기·끄기 */
export async function PATCH(req: NextRequest) {
  const denied = await guard(); if (denied) return denied;
  const { appid, action, value } = await req.json().catch(() => ({}));
  if (!Number.isInteger(appid)) return NextResponse.json({ error: "appid가 올바르지 않습니다." }, { status: 400 });
  if (action === "tier") {
    const v = value === "auto" ? null : String(value);
    if (v !== null && !["hot", "mid", "calm", "idle"].includes(v)) return NextResponse.json({ error: "단계가 올바르지 않습니다." }, { status: 400 });
    await sql`update games set tier_override = ${v} where appid = ${appid}`;
  } else if (action === "archive") {
    await sql`update games set status = 'archived' where appid = ${appid}`;
  } else if (action === "unarchive") {
    await sql`update games set status = case when last_collected_at is null then 'collecting' else 'active' end where appid = ${appid} and status = 'archived'`;
  } else if (action === "ai") {
    await sql`update games set ai_enabled = ${!!value} where appid = ${appid}`;
  } else return NextResponse.json({ error: "알 수 없는 동작입니다." }, { status: 400 });
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
