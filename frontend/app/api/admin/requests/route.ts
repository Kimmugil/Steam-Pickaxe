import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { addGame, guard } from "@/lib/admin-actions";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  const denied = await guard(); if (denied) return denied;
  const { appid, action } = await req.json().catch(() => ({}));
  if (!Number.isInteger(appid)) return NextResponse.json({ error: "appid가 올바르지 않습니다." }, { status: 400 });
  if (action === "hold") {
    await sql`update game_requests set status = 'held', updated_at = now() where appid = ${appid}`;
    return NextResponse.json({ ok: true, message: "요청을 보류했습니다." });
  }
  if (action === "approve") {
    const r = await addGame(appid, 6);
    if (r.ok) { await sql`update game_requests set status = 'approved', updated_at = now() where appid = ${appid}`; revalidatePath("/"); }
    return NextResponse.json(r, { status: r.ok ? 200 : 404 });
  }
  return NextResponse.json({ error: "알 수 없는 동작입니다." }, { status: 400 });
}
