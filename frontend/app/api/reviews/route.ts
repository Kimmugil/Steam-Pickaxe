import { NextRequest, NextResponse } from "next/server";
import { plain, sql } from "@/lib/db";
import { limited } from "@/lib/ratelimit";

export async function GET(req: NextRequest) {
  if (await limited("reviews", 60, 60)) return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 뒤에 다시 시도해 주세요." }, { status: 429 });
  const p = req.nextUrl.searchParams;
  const appid = Number(p.get("appid"));
  if (!Number.isInteger(appid) || appid <= 0) return NextResponse.json({ error: "appid가 올바르지 않습니다." }, { status: 400 });
  const period = p.get("period") ?? "all", lang = p.get("lang") ?? "all", band = p.get("band") ?? "all", vote = p.get("vote") ?? "all";
  const page = Math.min(Math.max(Number(p.get("page") ?? 0) || 0, 0), 200);
  const days = period === "30" ? 30 : period === "7" ? 7 : 0;

  const rows = await sql`
    select recommendationid as id, voted_up as up, language as lang, left(review, 700) as text, created_at as at, votes_up as votes,
           round(playtime_at_review / 60.0)::int as hours
    from reviews
    where appid = ${appid}
      ${days ? sql`and created_at >= now() - make_interval(days => ${days})` : sql``}
      ${lang !== "all" ? sql`and language = ${lang}` : sql``}
      ${vote === "up" ? sql`and voted_up` : vote === "down" ? sql`and not voted_up` : sql``}
      ${band === "lt2" ? sql`and playtime_at_review < 120` : band === "2to100" ? sql`and playtime_at_review >= 120 and playtime_at_review < 6000` : band === "gt100" ? sql`and playtime_at_review >= 6000` : sql``}
    order by created_at desc limit 20 offset ${page * 20}`;
  return NextResponse.json({ rows: plain(rows) }, { headers: { "cache-control": "public, max-age=60" } });
}
