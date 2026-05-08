import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getConfig, syncUiText, resetUiText } from "@/lib/sheets";

/**
 * POST /api/admin/sync-ui-text
 *
 * Body: { password: string, reset?: boolean }
 *
 * reset=false (기본): 누락 키만 추가, 기존 값 보존
 * reset=true:  탭 전체 재작성 — FALLBACK 키만 남기고, 커스텀 값 유지, 미사용 키 제거
 *
 * FALLBACK은 UiTextContext.tsx 의 FALLBACK 객체와 완전히 동일하게 유지해야 합니다.
 * (서버 라우트에서 클라이언트 전용 Context를 import할 수 없어 별도 복사본으로 관리)
 */

// ── FALLBACK ──────────────────────────────────────────────────────────────────
// UiTextContext.tsx 의 FALLBACK 과 항상 동기화하세요.
// CMS 관리 키만 포함합니다. 나머지는 컴포넌트에 하드코딩됩니다.
const FALLBACK: Record<string, string> = {

  // ── 내비게이션 브랜드 ────────────────────────────────────────────────
  NAV_BRAND: "🌾 스팀 정미소",

  // ── 홈 페이지 ───────────────────────────────────────────────────────
  HOME_SUBTITLE: "업데이트 민심 · 트래픽 · 언어권 반응을 한눈에 꿰뚫는 스팀 분석 대시보드",

  // ── 등록 (CMS 관리) ──────────────────────────────────────────────────
  REGISTER_QUOTA_EXCEEDED: "곳간 용량 부족! 농장주(김무길)에게 곳간을 늘려달라고 하세요.",
  REGISTER_APPROVAL_NOTICE: "페이지 생성 후 AI 분석은 관리자 승인 이후 진행됩니다. 수집이 완료되면 대기열에서 진행 상황을 확인할 수 있습니다.",

  // ── 풀 고갈 오류 ─────────────────────────────────────────────────────
  POOL_EMPTY_MSG: "곳간 용량 부족! 농장주(김무길)에게 곳간을 늘려달라고 하세요.",
  POOL_EMPTY_RETRY_BTN: "곳간 보충 후 재시도",
  POOL_EMPTY_RETRY_SUCCESS: "재시도 요청 완료. 다음 수집 실행 시 자동으로 처리됩니다.",
  POOL_EMPTY_SHEET_HINT: "Sheet_Pool 탭에 새 시트를 추가한 후 진행하세요.",

  // ── 온보딩 안내 모달 ─────────────────────────────────────────────────
  ONBOARD_TRIGGER_LABEL: "처음 오셨나요?",
  ONBOARD_MODAL_TITLE:   "이용 안내",
  ONBOARD_BTN_CLOSE:     "닫기",
  ONBOARD_HOW_TITLE:     "사용 방법",
  ONBOARD_STEP1_TITLE:   "이 서비스는?",
  ONBOARD_STEP1_DESC:    "Steam 게임의 리뷰·평가 데이터를 수집해 트렌드와 이상 징후를 자동 분석하는 인텔리전스 대시보드입니다.",
  ONBOARD_STEP2_TITLE:   "게임 등록",
  ONBOARD_STEP2_DESC:    "우측 버튼으로 Steam 게임을 검색해 등록하면, 리뷰·CCU·공식 이벤트 데이터가 자동으로 수집됩니다.",
  ONBOARD_STEP3_TITLE:   "AI 분석",
  ONBOARD_STEP3_DESC:    "수집 데이터를 기반으로 평가 추이·급변 감지·언어별 반응·수명 주기 분석이 자동 진행됩니다.",
  ONBOARD_STEP3_NOTE:    "AI 브리핑은 관리자 승인 후 게시됩니다.",
  ONBOARD_STEP4_TITLE:   "대시보드 활용",
  ONBOARD_STEP4_DESC:    "게임 카드를 클릭하면 상세 차트, 키워드 타임라인, 이벤트 히스토리를 한눈에 확인할 수 있습니다.",

};

// ── 핸들러 ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, reset = false, force = false } = body as {
      password: string;
      reset?: boolean;
      force?: boolean;
    };

    if (!password) {
      return NextResponse.json({ error: "비밀번호가 필요합니다." }, { status: 400 });
    }

    const config = await getConfig();
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    if (reset) {
      // 전체 재작성: FALLBACK 키만 남기고, 미사용 키 제거
      // force=true: 코드 FALLBACK 값으로 모두 덮어씀 (커스텀 값 무시)
      // force=false: 기존 커스텀 값 보존
      const result = await resetUiText(FALLBACK, force);
      revalidateTag("ui-text"); // UI Text 캐시 즉시 무효화
      return NextResponse.json({ ok: true, mode: force ? "force" : "reset", ...result });
    } else {
      // 누락 키만 추가 (기존 값 보존)
      const result = await syncUiText(FALLBACK);
      revalidateTag("ui-text"); // UI Text 캐시 즉시 무효화
      return NextResponse.json({ ok: true, mode: "sync", ...result });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
