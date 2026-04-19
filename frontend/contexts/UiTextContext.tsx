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
const FALLBACK: Record<string, string> = {
  // ── 내비게이션 ──────────────────────────────────────────────────────
  NAV_BRAND: "⚡ 스팀 탈곡기 Pro",
  NAV_GUIDE: "분석 방법 가이드",

  // ── 홈 페이지 ───────────────────────────────────────────────────────
  HOME_TITLE: "Steam 게임 마켓 인텔리전스",
  HOME_SUBTITLE: "업데이트 민심 · 트래픽 · 언어권 반응을 한눈에 꿰뚫는 스팀 분석 대시보드",

  // ── 검색창 ──────────────────────────────────────────────────────────
  SEARCH_PLACEHOLDER: "게임명, AppID, 또는 스팀 상점 URL 입력",
  SEARCH_HINT: "스팀 특성상 한글 검색 시 결과가 부정확할 수 있습니다. 영문 검색을 권장합니다.",
  SEARCH_BTN: "검색",
  SEARCH_BTN_LOADING: "검색 중...",
  SEARCH_NOT_FOUND: "검색 결과를 찾을 수 없습니다.",
  SEARCH_ALREADY_REGISTERED: "이미 등록된 게임입니다. 상세 페이지로 이동합니다.",
  SEARCH_NOT_GAME: "게임 타입의 앱만 등록 가능합니다.",

  // ── 등록 ────────────────────────────────────────────────────────────
  REGISTER_BTN: "이 게임 분석 등록하기",
  REGISTER_BTN_LOADING: "등록 중...",
  REGISTER_SUCCESS: "{name} 등록 완료! 수집이 시작됩니다.",
  REGISTER_ERROR: "등록 중 오류가 발생했습니다.",
  REGISTER_QUOTA_EXCEEDED: "곳간 용량 부족! 농장주(김무길)에게 곳간을 늘려달라고 하세요.",

  // ── 검색 결과 메타 레이블 ────────────────────────────────────────────
  RESULT_LABEL_APPID: "AppID",
  RESULT_LABEL_RELEASE: "출시일",
  RESULT_LABEL_DEVELOPER: "개발사",
  RESULT_LABEL_PUBLISHER: "배급사",
  RESULT_LABEL_REVIEWS: "리뷰",
  RESULT_LABEL_POSITIVE_RATE: "긍정률",

  // ── 수집 대기열 ─────────────────────────────────────────────────────
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

  // ── 게임 목록 ───────────────────────────────────────────────────────
  GAMES_SECTION_TITLE: "분석 완료된 게임",
  GAMES_EMPTY_ICON: "🎮",
  GAMES_EMPTY_TITLE: "아직 등록된 게임이 없습니다.",
  GAMES_EMPTY_SUBTITLE: "위 검색창에서 Steam 게임을 검색하고 등록해 보세요.",

  // ── 게임 카드 ───────────────────────────────────────────────────────
  CARD_REVIEWS_LABEL: "리뷰 {n}건",
  CARD_EVENTS_LABEL: "이벤트 {n}건",
  CARD_DAYS_AGO: "{n}일 전 업데이트",
  CARD_LAST_EVENT_LABEL: "최근 이벤트",
  CARD_AI_DATE_LABEL: "AI 분석",

  // ── 관리자 모달 ─────────────────────────────────────────────────────
  ADMIN_PW_TITLE: "관리자 비밀번호 확인",
  ADMIN_PW_PLACEHOLDER: "비밀번호 입력",
  ADMIN_CLOSE_BTN: "닫기",
  ADMIN_GENERIC_ERROR: "오류가 발생했습니다.",

  // ── 풀 고갈 오류 ─────────────────────────────────────────────────────
  POOL_EMPTY_MSG: "곳간 용량 부족! 농장주(김무길)에게 곳간을 늘려달라고 하세요.",
  POOL_EMPTY_RETRY_BTN: "곳간 보충 후 재시도",
  POOL_EMPTY_RETRY_SUCCESS: "재시도 요청 완료. 다음 수집 실행 시 자동으로 처리됩니다.",
  POOL_EMPTY_SHEET_HINT: "Sheet_Pool 탭에 새 시트를 추가한 후 진행하세요.",

  // ── 수집 대기열 — 추가 ───────────────────────────────────────────────────
  QUEUE_COLLECTING_ERROR: "수집 오류",
  QUEUE_REVIEWS_PROGRESS: "리뷰 {collected} / {total}건",
  QUEUE_FORCE_ACTIVATE_BTN: "⚡ 지금 분석 바로 시작",
  QUEUE_FORCE_ACTIVATE_MODAL_TITLE: "⚡ 지금 분석 바로 시작",
  QUEUE_FORCE_ACTIVATE_MODAL_DESC: "현재 수집된 리뷰 {collected}건으로 즉시 분석을 시작합니다. 이후 새 리뷰는 다음 정기 수집에서 추가됩니다.",
  QUEUE_FORCE_ACTIVATE_CONFIRM_BTN: "분석 시작",
  QUEUE_FORCE_ACTIVATE_SUCCESS: "분석을 시작합니다. 잠시 후 분석 목록에서 확인하세요.",
  QUEUE_CURSOR_STUCK_MSG: "수집이 중단된 것 같습니다. 초기화 후 처음부터 재수집할 수 있습니다.",
  QUEUE_CURSOR_RESET_BTN: "cursor 초기화 (처음부터 재수집)",
  QUEUE_CURSOR_RESET_MODAL_DESC: "cursor를 초기화하고 처음부터 다시 수집합니다.",
  QUEUE_CURSOR_RESET_CONFIRM_BTN: "cursor 초기화",
  QUEUE_CURSOR_RESET_SUCCESS: "커서 초기화 완료. 다음 수집 시 처음부터 재시작됩니다.",
  PROCESSING: "처리 중...",

  // ── 타임라인 — 이벤트 수정 ──────────────────────────────────────────────
  TIMELINE_SPARSE_LABEL: "리뷰 부족 (인접 구간에 합산)",
  TIMELINE_FEW_REVIEWS_LABEL: "리뷰 {n}건",
  TIMELINE_EDIT_BTN: "✏️ 수정",
  TIMELINE_EDIT_TITLE: "이벤트 수정",
  TIMELINE_EDIT_ORIGINAL_TITLE_LABEL: "원본 제목:",
  TIMELINE_EDIT_TITLE_KR_LABEL: "한국어 제목 (AI 생성 또는 직접 입력)",
  TIMELINE_EDIT_TITLE_KR_PLACEHOLDER: "예: v2.5 밸런스 패치 — 캐릭터·기술 조정",
  TIMELINE_EDIT_TYPE_LABEL: "이벤트 유형",
  TIMELINE_EDIT_DATE_LABEL: "날짜",
  TIMELINE_EDIT_REANALYZE_LABEL: "이벤트 유형·날짜 변경 시 AI 재분석 트리거",
  TIMELINE_EDIT_SAVE_BTN: "저장",
  TIMELINE_EDIT_SAVING: "저장 중...",
  TIMELINE_EDIT_SUCCESS: "수정이 완료되었습니다.",
  TIMELINE_EDIT_SAVED_NOTICE: "수정이 완료됐습니다. 새로고침 시 반영됩니다.",

  // ── 게임 헤더 메타 레이블 ────────────────────────────────────────────────
  META_GENRES: "장르",
  META_RELEASE_DATE: "출시일",
  META_DEVELOPER: "개발사",
  META_PUBLISHER: "배급사",
  META_PRICE: "판매가",
  META_FREE: "무료",

  // ── 챗봇 ────────────────────────────────────────────────────────────
  CHATBOT_TOOLTIP: "{gameName} 분석에서 궁금한 점이 있나요? 무길봇에게 물어보세요",
  CHATBOT_HEADER_SUFFIX: "— AI 분석",
  CHATBOT_EMPTY_MSG: "이 게임에 대해 무엇이든 물어보세요.",
  CHATBOT_Q1: "최근 업데이트 후 유저 반응은?",
  CHATBOT_Q2: "어느 지역 플레이어가 가장 많아?",
  CHATBOT_Q3: "긍정률이 떨어진 이유는?",
  CHATBOT_LIMIT_MSG: "오늘 질문 한도에 도달했어요. 내일 다시 이용해 주세요.",
  CHATBOT_ERROR_MSG: "응답을 생성하지 못했습니다.",
  CHATBOT_INPUT_PLACEHOLDER: "질문 입력...",
  CHATBOT_INPUT_PLACEHOLDER_LIMIT: "오늘 한도 도달",
  CHATBOT_SEND_BTN: "전송",
  CHATBOT_DISCLAIMER: "데이터에 기반한 현상 진단만 제공합니다",

  // ── 게임 헤더 (dashboard/Header.tsx) ────────────────────────────────
  HEADER_APPID_LABEL: "AppID:",
  HEADER_STEAM_LINK: "Steam 상점 바로가기 ↗",
  HEADER_REVIEWS_LABEL: "리뷰",
  HEADER_REVIEWS_UNIT: "건",
  HEADER_CCU_LABEL: "현재 CCU",
  HEADER_CCU_UNIT: "명",
  HEADER_CCU_PEAK_LABEL: "역대 최고",
  HEADER_CCU_PEAK_SUFFIX: "대비",
  HEADER_AI_BRIEFING_TITLE: "AI 현황 진단",
  HEADER_AI_BRIEFING_DATE: "마지막 분석:",
  BADGE_F2P: "F2P",
  BADGE_EARLY_ACCESS: "Early Access",

  // ── 통계 항목 레이블 + 툴팁 ─────────────────────────────────────────
  STAT_OWNERS_LABEL: "추정 소유자",
  STAT_OWNERS_TOOLTIP: "SteamSpy 통계적 추정치입니다. 실제값과 차이가 있을 수 있습니다.",
  STAT_AVG_PLAYTIME_LABEL: "평균 플레이타임",
  STAT_AVG_PLAYTIME_TOOLTIP: "SteamSpy 추정치 기반입니다.",
  STAT_MEDIAN_PLAYTIME_LABEL: "중간값 플레이타임",
  STAT_MEDIAN_PLAYTIME_TOOLTIP: "SteamSpy 추정치 기반입니다.",
  STAT_ACTIVE_2W_LABEL: "2주 활성 플레이어",
  STAT_ACTIVE_2W_TOOLTIP: "최근 2주간 플레이한 유저 수. SteamSpy 추정치입니다.",
  STAT_RETENTION_LABEL: "잔존율",
  STAT_RETENTION_TOOLTIP: "최근 2주 활성 플레이어 ÷ 추정 소유자 수. SteamSpy 추정치 기반으로 절대값이 아닌 상대 비교 지표로 활용하세요.",

  // ── 대시보드 탭 ─────────────────────────────────────────────────────
  TAB_CCU: "글로벌 트래픽 (CCU)",
  TAB_SENTIMENT: "평가 추이",
  TAB_LANGUAGE: "언어권별 분포",

  // ── 업데이트 히스토리 섹션 ───────────────────────────────────────────
  HISTORY_TITLE: "업데이트 히스토리",

  // ── 타임라인 ────────────────────────────────────────────────────────
  TIMELINE_SORT_DESC: "▼ 최신순",
  TIMELINE_SORT_ASC: "▲ 과거순",
  TIMELINE_PENDING: "AI 분석 진행 중...",
  TIMELINE_TYPE_OFFICIAL: "공식 패치",
  TIMELINE_TYPE_MANUAL: "수동 이벤트",
  TIMELINE_TYPE_NEWS: "외부 뉴스",
  TIMELINE_TYPE_FREE_WEEKEND: "무료 주말",
  TIMELINE_TYPE_LAUNCH: "런칭",
  TIMELINE_SALE_TEXT: "할인 중",
  TIMELINE_PATCH_SUMMARY: "패치 내용 요약",
  TIMELINE_REACTION: "유저 반응 진단",
  TIMELINE_REVIEW_COUNT: "해당 구간 수집 리뷰: {n}건",
  TIMELINE_TOP_REVIEWS: "핵심 대표 리뷰",
  TIMELINE_PATCH_NOTES_LINK: "공식 패치노트 원문 보기 ↗",
  REVIEW_POSITIVE: "긍정",
  REVIEW_NEGATIVE: "부정",

  // ── 이벤트 등록 폼 ──────────────────────────────────────────────────
  EVENT_FORM_TOGGLE: "수동 이슈/이벤트 등록 (관리자)",
  EVENT_TITLE_PLACEHOLDER: "이벤트 제목 (예: 서버 장애, 대규모 업데이트)",
  EVENT_URL_PLACEHOLDER: "이벤트 URL (선택, 패치노트/공지 링크)",
  EVENT_CONTENT_PLACEHOLDER: "패치노트 전문, 공지사항, 커뮤니티 포스트 내용을 직접 붙여넣으세요.\nAI가 이 텍스트를 바탕으로 타임라인 카드를 생성합니다.\n(URL만으로 크롤링이 어려울 때 활용)",
  EVENT_SUBMIT_BTN: "이벤트 등록 + 재분석",
  EVENT_SUBMIT_BTN_LOADING: "등록 중...",
  EVENT_AUTH_TITLE: "이벤트 등록 인증",
  EVENT_SUCCESS: "이벤트가 등록되었습니다. 재분석이 시작됩니다.",

  // ── AI 분석 새로고침 ─────────────────────────────────────────────────
  REANALYZE_TITLE: "AI 분석 새로고침",
  REANALYZE_DESC: "최신 뉴스·패치 재수집 후 AI 분석을 다시 실행합니다. 완료까지 수분~수십 분 소요될 수 있습니다.",
  REANALYZE_BTN: "분석 새로고침",
  REANALYZE_BTN_LOADING: "요청 중...",
  REANALYZE_SUCCESS: "분석 새로고침이 요청됐습니다. 수분 내 반영됩니다.",
  REANALYZE_AUTH_DESC: "최신 뉴스·패치를 재수집하고 AI 분석을 다시 실행합니다.",

  // ── 게임 삭제 ────────────────────────────────────────────────────────
  DELETE_TITLE: "게임 삭제",
  DELETE_DESC: "홈 화면에서 숨깁니다. 수집된 데이터는 모두 보존됩니다.",
  DELETE_BTN: "이 게임 삭제 (소프트 삭제)",
  DELETE_SOFT_NOTICE: "데이터는 보존됩니다. 홈 화면에서만 숨겨집니다.",
  DELETE_CONFIRM_BTN: "삭제 확인",
  DELETE_BTN_LOADING: "삭제 중...",
  DELETE_CANCEL_BTN: "취소",
  DELETE_SUCCESS: "게임이 삭제되었습니다.",
  DELETE_AUTH_TITLE: "게임 삭제 인증",
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
