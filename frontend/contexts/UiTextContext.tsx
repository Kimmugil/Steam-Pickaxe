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

// ── 폴백 텍스트 ───────────────────────────────────────────────────────────────
// Sheets API 장애 / ui_text 탭 미존재 시에도 최소한의 UI가 정상 작동하도록
// 절대적으로 필요한 항목만 포함합니다.
const FALLBACK: Record<string, string> = {
  // 홈 페이지
  HOME_TITLE: "Steam 게임 마켓 인텔리전스",
  HOME_SUBTITLE: "업데이트 민심 · 트래픽 · 언어권 반응을 한눈에 꿰뚫는 스팀 분석 대시보드",

  // 검색창
  SEARCH_PLACEHOLDER: "게임명, AppID, 또는 스팀 상점 URL 입력",
  SEARCH_HINT: "스팀 특성상 한글 검색 시 결과가 부정확할 수 있습니다. 영문 검색을 권장합니다.",
  SEARCH_BTN: "검색",
  SEARCH_BTN_LOADING: "검색 중...",
  SEARCH_NOT_FOUND: "검색 결과를 찾을 수 없습니다.",
  SEARCH_ALREADY_REGISTERED: "이미 등록된 게임입니다. 상세 페이지로 이동합니다.",
  SEARCH_NOT_GAME: "게임 타입의 앱만 등록 가능합니다.",

  // 등록
  REGISTER_BTN: "이 게임 분석 등록하기",
  REGISTER_BTN_LOADING: "등록 중...",
  REGISTER_SUCCESS: "{name} 등록 완료! 수집이 시작됩니다.",
  REGISTER_ERROR: "등록 중 오류가 발생했습니다.",
  REGISTER_QUOTA_EXCEEDED: "곳간 용량 부족! 농장주(김무길)에게 곳간을 늘려달라고 하세요.",

  // 검색 결과 메타 레이블
  RESULT_LABEL_APPID: "AppID",
  RESULT_LABEL_RELEASE: "출시일",
  RESULT_LABEL_DEVELOPER: "개발사",
  RESULT_LABEL_PUBLISHER: "배급사",
  RESULT_LABEL_REVIEWS: "리뷰",
  RESULT_LABEL_POSITIVE_RATE: "긍정률",

  // 수집 대기열
  QUEUE_SECTION_TITLE: "데이터 수집 대기열",
  QUEUE_COLLECTING: "수집 중...",
  QUEUE_CANCEL_BTN: "등록 취소",
  QUEUE_CANCEL_CONFIRM_BTN: "등록 취소 확인",
  QUEUE_CANCEL_SUCCESS: "등록이 취소되었습니다.",
  QUEUE_ETA_SOON: "잠시 후 완료",
  QUEUE_ETA_HOURS: "약 {hours}시간",
  QUEUE_ETA_MINS: "약 {mins}분",
  QUEUE_ETA_LABEL: "예상 잔여 시간",
  QUEUE_ETA_SUFFIX: "(Steam API 상태에 따라 변동)",

  // 게임 목록
  GAMES_SECTION_TITLE: "분석 완료된 게임",
  GAMES_EMPTY_ICON: "🎮",
  GAMES_EMPTY_TITLE: "아직 등록된 게임이 없습니다.",
  GAMES_EMPTY_SUBTITLE: "위 검색창에서 Steam 게임을 검색하고 등록해 보세요.",

  // 관리자 모달
  ADMIN_PW_TITLE: "관리자 비밀번호 확인",
  ADMIN_PW_PLACEHOLDER: "비밀번호 입력",
  ADMIN_CLOSE_BTN: "닫기",
  ADMIN_GENERIC_ERROR: "오류가 발생했습니다.",

  // 내비게이션
  NAV_BRAND: "⚡ 스팀 탈곡기 Pro",
  NAV_GUIDE: "분석 방법 가이드",

  // 풀 고갈 오류 (error_pool_empty 상태)
  POOL_EMPTY_MSG: "곳간 용량 부족! 농장주(김무길)에게 곳간을 늘려달라고 하세요.",
  POOL_EMPTY_RETRY_BTN: "곳간 보충 후 재시도",
  POOL_EMPTY_RETRY_SUCCESS: "재시도 요청 완료. 다음 수집 실행 시 자동으로 처리됩니다.",
};

// ── Context 타입 ──────────────────────────────────────────────────────────────
type UiTextContextValue = {
  /**
   * 키로 텍스트를 조회하고, 필요 시 {변수명} 플레이스홀더를 치환합니다.
   *
   * @param key   - ui_text 시트의 key 컬럼 값 (예: "REGISTER_SUCCESS")
   * @param vars  - 치환할 변수 맵 (예: { name: "Elden Ring" })
   * @returns     - 최종 텍스트 문자열
   *
   * @example
   * t("REGISTER_SUCCESS", { name: "Elden Ring" })
   * // 시트: "{name} 등록 완료!" → "Elden Ring 등록 완료!"
   *
   * t("QUEUE_ETA_HOURS", { hours: 3 })
   * // 시트: "약 {hours}시간" → "약 3시간"
   */
  t: (key: string, vars?: Record<string, string | number>) => string;

  /** 병합된 원시 텍스트 맵 (폴백 + Sheets 값). 서버 컴포넌트 prop 전달 등에 사용. */
  raw: Record<string, string>;
};

// ── Context 초기값 (Provider 외부에서 실수로 사용될 경우 폴백 동작) ──────────
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
/**
 * UiTextProvider
 *
 * layout.tsx (Server Component)가 getUiText()로 조회한 Sheets 데이터를
 * initialText prop으로 주입합니다. 클라이언트 측 재조회 없이
 * SSR 시점에 데이터가 완전히 주입되므로 깜빡임(Flash) 없이 동작합니다.
 */
export function UiTextProvider({
  children,
  initialText,
}: {
  children: ReactNode;
  initialText: Record<string, string>;
}) {
  // FALLBACK + Sheets 값 병합 (Sheets가 우선)
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
/**
 * useUiText()
 *
 * 클라이언트 컴포넌트에서 동적 UI 텍스트를 사용하기 위한 훅입니다.
 *
 * @example
 * const { t } = useUiText();
 * return <button>{t("SEARCH_BTN")}</button>;
 *
 * @example
 * const { t } = useUiText();
 * show(t("REGISTER_SUCCESS", { name: "Elden Ring" }), "success");
 */
export function useUiText() {
  return useContext(UiTextContext);
}
