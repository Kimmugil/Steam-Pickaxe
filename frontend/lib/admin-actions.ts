import { NextResponse } from "next/server";
import { isAdmin } from "./auth";
import { sql } from "./db";
import { appDetails } from "./steam";

/** 관리자 API 공통 관문: 로그인하지 않았으면 401 */
export async function guard(): Promise<NextResponse | null> {
  return (await isAdmin()) ? null : NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
}

/** 새 게임 등록: Steam에서 정보를 가져와 '수집 중' 상태로 넣습니다. 이후 수집기가 전체 리뷰를 받습니다. */
export async function addGame(appid: number, aiMonths: number | null): Promise<{ ok: boolean; message: string; name?: string }> {
  const d = await appDetails(appid);
  if (!d?.name) return { ok: false, message: `Steam에서 AppID ${appid} 의 정보를 찾지 못했습니다.` };
  const aiSince = aiMonths && aiMonths > 0 ? new Date(Date.now() - aiMonths * 30 * 86400000).toISOString().slice(0, 10) : null;
  await sql`
    insert into games (appid, name, thumbnail, status, tier, release_date, release_date_text, genres, developer, publisher, price, is_free, is_early_access, ai_since)
    values (${appid}, ${d.name}, ${d.thumbnail}, 'collecting', 'hot', ${d.release_date}, ${d.release_date_text}, ${d.genres}, ${d.developer}, ${d.publisher},
            ${d.price}, ${d.is_free}, ${d.is_early_access}, ${aiSince})
    on conflict (appid) do update set status = case when games.status = 'archived' then 'collecting' else games.status end`;
  await sql`insert into price_history (appid, day, price_final, discount_percent) values (${appid}, current_date, ${d.price_final}, ${d.discount_percent})
            on conflict (appid, day) do nothing`;
  return { ok: true, message: `${d.name} 을(를) 추가했습니다. 다음 수집 때 전체 리뷰를 받기 시작합니다.`, name: d.name };
}
