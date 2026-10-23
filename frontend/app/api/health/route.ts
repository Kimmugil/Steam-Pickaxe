import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/** 배포가 제대로 연결됐는지 보는 점검용 주소. 비밀 값은 보여 주지 않고 '있다/없다'와 접속 성공 여부만 알려 줍니다. */
export async function GET() {
  const env = {
    SUPABASE_DB_URL: !!process.env.SUPABASE_DB_URL,
    ADMIN_PASSWORD_HASH: !!process.env.ADMIN_PASSWORD_HASH,
    SESSION_SECRET: (process.env.SESSION_SECRET?.length ?? 0) >= 24,
  };
  let db: { ok: boolean; games?: number; error?: string } = { ok: false };
  try {
    const [r] = await sql`select count(*)::int as n from games`;
    db = { ok: true, games: r.n };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    db = { ok: false, error: `${err.code ?? "ERROR"}: ${String(err.message ?? "").slice(0, 120).replace(/postgres(ql)?:\/\/\S+/g, "***")}` };
  }
  return NextResponse.json({ env, db }, { status: db.ok ? 200 : 500, headers: { "cache-control": "no-store" } });
}
