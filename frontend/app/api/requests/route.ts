import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { limited } from "@/lib/ratelimit";

/** 방문자의 게임 추가 요청. 바로 추가되지 않고 관리자 '해야 할 일'에 쌓입니다. */
export async function POST(req: NextRequest) {
  if (await limited("requests", 5, 600)) return NextResponse.json({ error: "요청이 너무 잦습니다. 잠시 뒤에 다시 시도해 주세요." }, { status: 429 });
  const b = await req.json().catch(() => null);
  const appid = Number(b?.appid);
  const name = String(b?.name ?? "").trim().slice(0, 120);
  if (!Number.isInteger(appid) || appid <= 0 || !name) return NextResponse.json({ error: "게임 정보가 올바르지 않습니다." }, { status: 400 });
  const meta = String(b?.meta ?? "").slice(0, 120) || null;
  const memo = String(b?.memo ?? "").trim().slice(0, 200) || null;

  const [existing] = await sql`select status from games where appid = ${appid}`;
  if (existing && existing.status !== "archived") return NextResponse.json({ message: "이미 추적 중인 게임입니다." });
  const [{ n }] = await sql`select count(*)::int as n from game_requests where status = 'open'`;
  if (n >= 200) return NextResponse.json({ error: "대기 중인 요청이 너무 많습니다. 관리자에게 직접 문의해 주세요." }, { status: 429 });

  await sql`insert into game_requests (appid, name, meta, memo) values (${appid}, ${name}, ${meta}, ${memo})
            on conflict (appid) do update set request_count = game_requests.request_count + 1,
              memo = coalesce(excluded.memo, game_requests.memo), status = 'open', updated_at = now()`;
  return NextResponse.json({ message: "요청을 보냈습니다. 관리자가 확인한 뒤 추가합니다." });
}
