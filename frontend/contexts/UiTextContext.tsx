"use client";

/**
 * UiTextContext — Google Sheets CMS 기반 동적 UI 텍스트 시스템
 *
 * 흐름:
 *   Sheets(ui_text 탭) → getUiText() [서버, 60s 캐시]
 *     → layout.tsx가 initialText로 주입
 *       → UiTextProvider (Client Component)
 *         → useUiText().t("KEY") 로 모든 컴포넌트에서 사용
 *
 * t() 함수는 {변수명} 플레이스홀더 치환을 지원합니다.
 *   예) 시트 값: "{name} 등록 완료!"
 *       호출:   t("REGISTER_SUCCESS", { name: "Elden Ring" })
 *       결과:   "Elden Ring 등록 완료!"
 */

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

// ── 폴백 텍스트 (CMS 관리 키만 포함) ─────────────────────────────────────────
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

// ── Context 타입 ──────────────────────────────────────────────────────────────
type UiTextContextValue = {
  /**
   * 키로 텍스트를 조회하고, 필요 시 {변수명} 플레이스홀더를 치환합니다.
   */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** 병합된 원시 텍스트 맵 (폴백 + Sheets 값). */
  raw: Record<string, string>;
};

// ── Context 초기값 ────────────────────────────────────────────────────────────
const UiTextContext = createContext<UiTextContextValue>({
  t: (key, vars) => applyVars(FALLBACK[key] ?? key, vars),
  raw: FALLBACK,
});

// ── 헬퍼: {변수명} 치환 ───────────────────────────────────────────────────────
function applyVars(
  str: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return str;
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
    str
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function UiTextProvider({
  children,
  initialText,
}: {
  children: ReactNode;
  initialText: Record<string, string>;
}) {
  const merged = useMemo(
    () => ({ ...FALLBACK, ...initialText }),
    [initialText]
  );

  const value = useMemo<UiTextContextValue>(
    () => ({
      t: (key, vars) => applyVars(merged[key] ?? key, vars),
      raw: merged,
    }),
    [merged]
  );

  return (
    <UiTextContext.Provider value={value}>{children}</UiTextContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useUiText() {
  return useContext(UiTextContext);
}
