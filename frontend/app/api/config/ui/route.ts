/**
 * GET /api/config/ui
 *
 * Google Sheets의 ui_text 탭 내용을 { KEY: "값" } JSON으로 반환합니다.
 * getUiText()는 unstable_cache로 서버 측 60초 TTL 캐싱이 적용되어 있어
 * Sheets API 호출 횟수가 최소화됩니다.
 *
 * 사용처: 외부 디버깅, 관리 도구, 또는 클라이언트 측 직접 조회 시.
 * 일반적인 SSR 경로에서는 layout.tsx → UiTextProvider를 통해 제공됩니다.
 */
import { NextResponse } from "next/server";
import { getUiText } from "@/lib/sheets";

// Next.js Route Segment 캐시 — CDN/Edge 레이어 60초 캐싱
export const revalidate = 60;

export async function GET() {
  try {
    const text = await getUiText();
    return NextResponse.json(text, {
      headers: {
        // 브라우저 캐시 방지 (항상 서버에서 최신 TTL 기준으로 제공)
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "ui_text 로드 실패", detail: String(e) },
      { status: 500 }
    );
  }
}
