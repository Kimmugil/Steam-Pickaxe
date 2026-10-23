import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/admin-actions";
import { sql } from "@/lib/db";

export const maxDuration = 60;

/** SteamDB에서 내려받은 동접 CSV("DateTime","Players") 업로드. 이미 있는 시각은 건너뜁니다. */
export async function POST(req: NextRequest) {
  const denied = await guard(); if (denied) return denied;
  const form = await req.formData().catch(() => null);
  const appid = Number(form?.get("appid"));
  const file = form?.get("file");
  if (!Number.isInteger(appid) || !(file instanceof File)) return NextResponse.json({ error: "게임과 CSV 파일을 선택해 주세요." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "파일이 너무 큽니다 (8MB 이하)." }, { status: 400 });
  const [g] = await sql`select 1 from games where appid = ${appid}`;
  if (!g) return NextResponse.json({ error: "등록되지 않은 게임입니다." }, { status: 404 });

  const lines = (await file.text()).replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const head = lines[0]?.toLowerCase().replace(/["\s]/g, "").split(",") ?? [];
  const ti = head.indexOf("datetime"), pi = head.indexOf("players");
  if (ti < 0 || pi < 0) return NextResponse.json({ error: '파일 첫 줄에 "DateTime"과 "Players" 열이 있어야 합니다.' }, { status: 400 });

  const times: string[] = [], vals: number[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const c = line.split(",").map((x) => x.replace(/"/g, "").trim());
    const players = Number(c[pi]);
    const t = new Date((c[ti] ?? "").replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(c[ti] ?? "") ? "" : "Z"));
    if (!c[pi] || !Number.isFinite(players) || Number.isNaN(t.getTime())) { skipped++; continue; }
    times.push(t.toISOString()); vals.push(Math.round(players));
  }
  if (!times.length) return NextResponse.json({ error: "읽을 수 있는 동접 기록이 없습니다." }, { status: 400 });
  let added = 0;
  for (let i = 0; i < times.length; i += 5000) {
    const r = await sql`insert into ccu_samples (appid, sampled_at, ccu, source)
                        select ${appid}, t::timestamptz, v, 'steamdb' from unnest(${times.slice(i, i + 5000)}::text[], ${vals.slice(i, i + 5000)}::int[]) as u(t, v)
                        on conflict do nothing`;
    added += r.count;
  }
  await sql`update games set ccu_history_imported = true where appid = ${appid}`;
  revalidatePath(`/game/${appid}`);
  return NextResponse.json({ ok: true, message: `${added.toLocaleString()}건을 추가했습니다. (읽은 ${times.length.toLocaleString()}건, 이미 있거나 건너뛴 ${(times.length - added + skipped).toLocaleString()}건)` });
}
