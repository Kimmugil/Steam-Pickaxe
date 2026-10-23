import { NextRequest, NextResponse } from "next/server";
import { clientKey, isLocked, makeToken, recordAttempt, sessionCookie, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!process.env.ADMIN_PASSWORD_HASH || !process.env.SESSION_SECRET)
    return NextResponse.json({ error: "관리자 비밀번호가 아직 설정되지 않았습니다. (ADMIN_PASSWORD_HASH, SESSION_SECRET 환경변수)" }, { status: 500 });
  const key = await clientKey();
  if (await isLocked(key)) return NextResponse.json({ error: "로그인에 여러 번 실패해 15분 동안 잠겼습니다. 잠시 뒤에 다시 시도해 주세요." }, { status: 429 });
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const ok = typeof password === "string" && password.length > 0 && verifyPassword(password);
  await recordAttempt(key, ok);
  if (!ok) return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  const { token, maxAge } = makeToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie.name, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
  return res;
}
