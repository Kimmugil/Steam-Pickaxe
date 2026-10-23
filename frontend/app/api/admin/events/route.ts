import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/admin-actions";
import { sql } from "@/lib/db";

/** 이벤트 수동 등록 (Steam 공지에 없는 일: 외부 방송, 대회, 논란 등) */
export async function POST(req: NextRequest) {
  const denied = await guard(); if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const appid = Number(b.appid), title = String(b.title ?? "").trim().slice(0, 200), date = String(b.date ?? "").slice(0, 10);
  if (!Number.isInteger(appid) || !title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "게임, 날짜(YYYY-MM-DD), 제목을 입력해 주세요." }, { status: 400 });
  const url = String(b.url ?? "").trim().slice(0, 500) || null;
  const content = String(b.content ?? "").trim().slice(0, 4000) || null;
  await sql`insert into events (appid, event_key, type, event_date, title, url, content) values (${appid}, ${"manual-" + randomUUID()}, 'manual', ${date}, ${title}, ${url}, ${content})`;
  revalidatePath(`/game/${appid}`);
  return NextResponse.json({ ok: true, message: "이벤트를 등록했습니다. 다음 분석 때 반영됩니다." });
}
