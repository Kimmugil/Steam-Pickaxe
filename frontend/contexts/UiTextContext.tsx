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
  NAV_USAGE: "이용 안내",

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
  TIMELINE_PENDING: "AI 분석 전",
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

  // ── 분석 방법 가이드 페이지 헤더 ────────────────────────────────────
  GUIDE_PAGE_TITLE: "분석 방법 가이드",
  GUIDE_PAGE_DESC: "Steam Pickaxe의 데이터 수집 기준, AI 분석 방식, 지표 해석 주의사항을 상세하게 안내합니다.",
  GUIDE_NAV_SECTION_LABEL: "기술 가이드",

  // ── 가이드 섹션 타이틀 (사이드바 + h2) ─────────────────────────────
  GUIDE_SEC_OVERVIEW: "🔍 시스템 개요",
  GUIDE_SEC_SCHEDULE: "📅 자동화 스케줄",
  GUIDE_SEC_REVIEWS: "📝 리뷰 수집",
  GUIDE_SEC_NEWS: "📰 뉴스·이벤트 수집",
  GUIDE_SEC_BUCKETING: "🪣 버킷팅 (구간 분할)",
  GUIDE_SEC_AI: "🤖 AI 분석 상세",
  GUIDE_SEC_METRICS: "📊 지표 해석 가이드",
  GUIDE_SEC_LIMITS: "⚠️ 데이터 한계 및 주의사항",

  // ── 시스템 개요 ──────────────────────────────────────────────────────
  GUIDE_OV_DESC: "Steam Pickaxe는 Steam 게임의 리뷰·뉴스·CCU를 자동 수집하고, Gemini AI로 이벤트 구간별 유저 반응을 분석하는 데이터 파이프라인입니다. 모든 분석 결과는 Google Sheets에 적재되며, 이 대시보드에서 시각화됩니다.",
  GUIDE_OV_INFO: "모든 AI 분석 결과는 현상 진단과 인과관계 추정에 한정됩니다. 지시적/주관적 권고는 생성하지 않으며, 추정 지표를 언급할 때는 반드시 '추정치'임을 명시합니다.",
  GUIDE_OV_T1_1: "수집 엔진",
  GUIDE_OV_T1_2: "Steam API 호출 → Google Sheets 적재",
  GUIDE_OV_T1_3: "Python / GitHub Actions",
  GUIDE_OV_T2_1: "AI 분석 엔진",
  GUIDE_OV_T2_2: "리뷰 감성 분석, 패치 요약, 추이 진단",
  GUIDE_OV_T2_3: "Google Gemini 2.5 Flash (Thinking 활성)",
  GUIDE_OV_T3_1: "데이터 저장소",
  GUIDE_OV_T3_2: "마스터 시트 + 게임별 전용 시트",
  GUIDE_OV_T3_3: "Google Sheets",
  GUIDE_OV_T4_1: "대시보드",
  GUIDE_OV_T4_2: "수집·분석 결과 시각화",
  GUIDE_OV_T4_3: "Next.js 15 / React",

  // ── 자동화 스케줄 ────────────────────────────────────────────────────
  GUIDE_SCH_INFO1: "새 게임 등록 후 리뷰 수집이 완료(collecting → active)되면 analyze.yml이 즉시 자동 트리거됩니다. 정규 21:00 스케줄을 기다리지 않습니다.",
  GUIDE_SCH_INFO2: "CCU AI 피크타임 분석과 언어권 교차 분석은 매주 월요일에만 갱신됩니다. 매일 동일한 패턴 데이터에서 동일한 분석 결과가 반복 생성되는 비용 낭비를 방지하기 위한 조건부 실행입니다.",
  GUIDE_SCH_T1_1: "collect.yml",
  GUIDE_SCH_T1_2: "매일 20:00 UTC",
  GUIDE_SCH_T1_3: "익일 05:00",
  GUIDE_SCH_T1_4: "리뷰 수집, 뉴스/이벤트 수집, 메타데이터 갱신",
  GUIDE_SCH_T2_1: "analyze.yml",
  GUIDE_SCH_T2_2: "매일 21:00 UTC",
  GUIDE_SCH_T2_3: "익일 06:00",
  GUIDE_SCH_T2_4: "AI 분석, 브리핑 갱신, CCU 피크타임 분석",
  GUIDE_SCH_T3_1: "ccu.yml",
  GUIDE_SCH_T3_2: "매 시간 정각",
  GUIDE_SCH_T3_3: "매 시간 +9h",
  GUIDE_SCH_T3_4: "현재 동접자 수 기록",

  // ── 리뷰 수집 ────────────────────────────────────────────────────────
  GUIDE_REV_H_API: "API 사양",
  GUIDE_REV_H_CURSOR: "커서 기반 페이지네이션",
  GUIDE_REV_H_DEDUP: "중복·수정·삭제 처리",
  GUIDE_REV_API_T1_1: "num_per_page",
  GUIDE_REV_API_T1_2: "80",
  GUIDE_REV_API_T1_3: "100 설정 시 일부 게임에서 리뷰 누락 버그 발생 — 80 고정",
  GUIDE_REV_API_T2_1: "filter",
  GUIDE_REV_API_T2_2: "recent",
  GUIDE_REV_API_T2_3: "최신순 커서 기반 전체 수집",
  GUIDE_REV_API_T3_1: "purchase_type",
  GUIDE_REV_API_T3_2: "all",
  GUIDE_REV_API_T3_3: "스팀 구매 + 패키지 구매 모두 포함",
  GUIDE_REV_API_T4_1: "language",
  GUIDE_REV_API_T4_2: "all",
  GUIDE_REV_API_T4_3: "전 언어 수집 (언어별 분리는 AI 분석 단계)",
  GUIDE_REV_CURSOR_L1: "Steam API가 반환하는 cursor 값을 다음 요청에 전달해 전체 리뷰를 순차 수집합니다.",
  GUIDE_REV_CURSOR_L2: "현재 커서 = 이전 커서 감지 시 → 자연 고갈(수집 완료)로 판단합니다.",
  GUIDE_REV_CURSOR_L3: "1회 최대 3,000페이지(240,000건) 수집 후 커서를 저장하고 다음 실행에서 이어 수집합니다. GitHub Actions 단일 Job 실행 시 약 25분 소요됩니다.",
  GUIDE_REV_DEDUP_L1: "recommendationid가 동일하면 중복 적재하지 않습니다.",
  GUIDE_REV_DEDUP_L2: "유저가 리뷰를 수정해도 ID가 변경되지 않으므로 최초 수집 버전이 보존됩니다.",
  GUIDE_REV_DEDUP_L3: "삭제된 리뷰는 수집된 이후 RAW에 계속 잔존합니다 (Steam이 삭제 신호를 보내지 않음).",
  GUIDE_REV_DEDUP_L4: "Steam 표시 총 리뷰 수는 삭제분이 제외되나, RAW 수집 건수는 포함될 수 있어 일치하지 않을 수 있습니다.",
  GUIDE_REV_INFO: "Steam이 language=all 파라미터로 반환하는 total_reviews는 실제 리뷰 수보다 적을 수 있습니다. 이 경우 수집 완료 조건을 누적 건수로 판정하면 오작동이 발생합니다. 커서 동일 감지(자연 고갈) 또는 전체 중복 반환 감지를 주 완료 조건으로 사용합니다.",

  // ── 뉴스·이벤트 수집 ────────────────────────────────────────────────
  GUIDE_NEWS_H_SOURCE: "수집 소스",
  GUIDE_NEWS_H_CLASS: "이벤트 분류 기준",
  GUIDE_NEWS_H_CONTENT: "content 본문 처리",
  GUIDE_NEWS_SRC_T1_1: "GetNewsForApp",
  GUIDE_NEWS_SRC_T1_2: "api.steampowered.com/ISteamNews",
  GUIDE_NEWS_SRC_T1_3: "공식 패치노트, 외부 뉴스. enddate 페이지네이션, 최대 10,000건",
  GUIDE_NEWS_SRC_T2_1: "Store Events API",
  GUIDE_NEWS_SRC_T2_2: "store.steampowered.com/events/ajaxgetadjacentpartnerevents",
  GUIDE_NEWS_SRC_T2_3: "스팀 스토어 이벤트. cursor 페이지네이션으로 GetNewsForApp 누락분 보완",
  GUIDE_NEWS_CLS_T1_1: "official (공식 패치)",
  GUIDE_NEWS_CLS_T1_2: "feed_type=1 또는 appauthor 일치 + Store event_type 9/13/14/15/22/28",
  GUIDE_NEWS_CLS_T1_3: "파란 점",
  GUIDE_NEWS_CLS_T2_1: "news (외부 뉴스)",
  GUIDE_NEWS_CLS_T2_2: "feed_type=0 또는 appauthor 불일치 + Store event_type 10/12",
  GUIDE_NEWS_CLS_T2_3: "회색 점",
  GUIDE_NEWS_CLS_T3_1: "manual (수동 등록)",
  GUIDE_NEWS_CLS_T3_2: "관리자가 직접 등록",
  GUIDE_NEWS_CLS_T3_3: "파란 점",
  GUIDE_NEWS_CLS_T4_1: "free_weekend",
  GUIDE_NEWS_CLS_T4_2: "is_free_weekend=true",
  GUIDE_NEWS_CLS_T4_3: "초록 점",
  GUIDE_NEWS_CONTENT_L1: "HTML 태그와 엔티티를 제거해 평문(plain text)으로 변환 후 저장합니다.",
  GUIDE_NEWS_CONTENT_L2: "최대 5,000자로 제한. 초과 시 ... [이하 생략]이 붙습니다.",
  GUIDE_NEWS_CONTENT_L3: "AI 패치 요약 프롬프트에 content가 있으면 본문 기반으로, 없으면 제목만으로 추정 요약합니다.",
  GUIDE_NEWS_INFO: "AI 패치 요약은 공지 유형을 먼저 판별(UPDATE / DELAY / MAINTENANCE / EVENT / ANNOUNCEMENT)한 뒤 유형에 맞는 방식으로 요약합니다. 지연 공지를 업데이트로 오인하는 오류를 방지합니다.",

  // ── 버킷팅 ───────────────────────────────────────────────────────────
  GUIDE_BKT_DESC: "이벤트를 기준점으로 시간축을 구간(버킷)으로 분할합니다. 각 버킷에는 해당 기간에 작성된 Steam 리뷰가 배정됩니다.",
  GUIDE_BKT_T1_1: "이벤트 N의 버킷 범위",
  GUIDE_BKT_T1_2: "이벤트 N 발생일 00:00:00 UTC ~ 다음 이벤트 전날 23:59:59 UTC",
  GUIDE_BKT_T2_1: "최신 이벤트 버킷",
  GUIDE_BKT_T2_2: "이벤트 발생일 ~ 분석 실행 시점",
  GUIDE_BKT_T3_1: "이벤트 0개인 게임",
  GUIDE_BKT_T3_2: "단일 런칭 버킷으로 전체 처리",
  GUIDE_BKT_T4_1: "뉴스 이벤트(news)",
  GUIDE_BKT_T4_2: "버킷 기준점이 되지 않음 — 공식/수동 이벤트만 구간 분할",
  GUIDE_BKT_T5_1: "수동 이벤트 추가 시",
  GUIDE_BKT_T5_2: "해당 날짜에서 기존 버킷을 2개로 분할 → 재분석",
  GUIDE_BKT_H_REANALYZE: "직전 이벤트 재분석",
  GUIDE_BKT_REANALYZE_DESC: "새 이벤트가 추가되면 직전 버킷의 end_ts가 새 이벤트 날짜로 잘려 리뷰 수가 달라집니다. 이를 반영하기 위해 새 이벤트 분석 시 직전 이벤트도 함께 재분석합니다.",
  GUIDE_BKT_H_SPARSE: "스파스(sparse) 버킷",
  GUIDE_BKT_SPARSE_DESC: "버킷 내 리뷰 수 ≤ 5건이면 감성 AI 분석을 생략하고 sparse로 표시합니다. 해당 버킷의 리뷰는 다음 버킷으로 이월(carry-over)됩니다. 공식 패치 이벤트의 경우 리뷰가 없어도 content 기반 패치 요약은 생성합니다.",

  // ── AI 분석 상세 ─────────────────────────────────────────────────────
  GUIDE_AI_H_MODEL: "모델 및 공통 원칙",
  GUIDE_AI_MODEL_L1: "모델: Google Gemini 2.5 Flash",
  GUIDE_AI_MODEL_L2: "Thinking 모드 활성 (thinking_budget=8,192 토큰): 감성 분석·인과관계 판단 전에 내부 추론 과정을 거쳐 분석 품질을 높입니다.",
  GUIDE_AI_MODEL_L3: "원칙: 현상 진단 + 인과관계만 서술. 지시적/주관적 어조 배제. 허구 수치 생성 금지.",
  GUIDE_AI_H1: "① 리뷰 샘플링 (Stratified Sampling)",
  GUIDE_AI_S1_DESC: "구간별 최대 2,000건 상한. 긍정/부정 원래 비율을 보존하는 계층 샘플링을 적용합니다.",
  GUIDE_AI_S1_L1: "전체 리뷰의 실제 긍정/부정 비율 계산",
  GUIDE_AI_S1_L2: "긍정 그룹: votes_up+votes_funny 상위 1,000건 + 최신 1,000건 혼합 → 비율에 맞게 할당",
  GUIDE_AI_S1_L3: "부정 그룹: 동일 전략으로 할당",
  GUIDE_AI_S1_L4: "효과: 예) 전체 90% 긍정 게임의 샘플이 60% 긍정으로 왜곡되는 현상 제거 → sentiment_rate 정확도 향상",
  GUIDE_AI_H2: "② 구간 감성 분석 (analyze_bucket)",
  GUIDE_AI_S2_T1_1: "sentiment_rate",
  GUIDE_AI_S2_T1_2: "긍정 리뷰 비율 0~100%",
  GUIDE_AI_S2_T2_1: "top_keywords",
  GUIDE_AI_S2_T2_2: "핵심 키워드 최대 5개 (외국어는 원문+한국어 번역)",
  GUIDE_AI_S2_T3_1: "ai_reaction_summary",
  GUIDE_AI_S2_T3_2: "유저 반응 요약 및 주요 변동 원인 2~4문장",
  GUIDE_AI_S2_T4_1: "top_reviews",
  GUIDE_AI_S2_T4_2: "대표 리뷰 3건 (원문 + 한국어 번역 + 긍부정 + 언어)",
  GUIDE_AI_S2_NOTE: "분석 범위: 전체(all) + top 3 언어 각각 → 버킷당 최대 4회 Gemini 호출",
  GUIDE_AI_H3: "③ 패치 요약 (analyze_patch_summary)",
  GUIDE_AI_S3_DESC: "공식(official) 이벤트에만 생성합니다. 공지 유형을 먼저 판별한 뒤 유형에 맞게 2~3문장 요약합니다.",
  GUIDE_AI_S3_T1_1: "UPDATE",
  GUIDE_AI_S3_T1_2: "실제 변경된 기능·수치를 요약",
  GUIDE_AI_S3_T2_1: "DELAY",
  GUIDE_AI_S3_T2_2: "'○○ 업데이트의 지연 공지로...'로 시작, 지연 이유 요약",
  GUIDE_AI_S3_T3_1: "MAINTENANCE",
  GUIDE_AI_S3_T3_2: "점검 내용과 범위 요약",
  GUIDE_AI_S3_T4_1: "EVENT",
  GUIDE_AI_S3_T4_2: "이벤트 내용과 기간 요약",
  GUIDE_AI_S3_T5_1: "ANNOUNCEMENT",
  GUIDE_AI_S3_T5_2: "예고된 내용 요약",
  GUIDE_AI_H4: "④ 평가 추이 종합 진단 (sentiment_trend_comment)",
  GUIDE_AI_S4_DESC: "2개 이상 버킷이 분석된 경우, 전체 구간에 걸친 감성률 변화 패턴을 종합 진단합니다. 단순히 최신 구간 요약을 재사용하는 것이 아닌, 전체 추이를 독립적으로 분석합니다.",
  GUIDE_AI_S4_L1: "전체 추이 방향 (상승/하락/안정/변동성 큼)",
  GUIDE_AI_S4_L2: "주요 전환점과 원인 추정",
  GUIDE_AI_S4_L3: "최근 기조와 장기 트렌드 비교",
  GUIDE_AI_H5: "⑤ CCU 피크타임 분석 (generate_ccu_peaktime_comment)",
  GUIDE_AI_S5_DESC: "전체 CCU 데이터를 KST 기준 24시간 평균으로 집약한 뒤, 피크 시간대 패턴으로 주력 플레이 권역을 추정합니다. 매주 월요일에만 갱신됩니다 (비용 절감 목적).",
  GUIDE_AI_H6: "⑥ 언어권 교차 분석 (generate_language_cross_analysis)",
  GUIDE_AI_S6_DESC: "RAW 리뷰 전체의 언어 분포와 각 언어별 평균 감성률을 종합합니다. Steam 영어 과대표집 문제를 감안해 실제 주력 권역과 권역 간 평가 온도차를 진단합니다. 매주 월요일에만 갱신됩니다.",
  GUIDE_AI_H7: "⑦ AI 브리핑 (generate_ai_briefing)",
  GUIDE_AI_S7_DESC: "최근 10개 구간의 날짜·제목·긍정률·리뷰수·요약을 종합하고 최근 3건 vs 이전 3건 추이 방향을 계산한 뒤, 게임 전반 현황을 3~5문장으로 진단합니다. 매일 갱신됩니다.",
  GUIDE_AI_INFO: "분석 언어 수: 기본적으로 상위 3개 언어만 언어별 감성 분석이 수행됩니다. 나머지 언어는 리뷰 분포(파이 차트)에는 표시되지만 AI 감성 분석 데이터는 없습니다. 언어 수를 늘리면 Gemini API 비용이 언어 수 × 이벤트 수만큼 증가합니다.",

  // ── 지표 해석 가이드 ─────────────────────────────────────────────────
  GUIDE_MTR_H_SENTIMENT: "긍정률 (sentiment_rate)",
  GUIDE_MTR_SR_T1_1: "80% 이상",
  GUIDE_MTR_SR_T1_2: "압도적으로 긍정적 — 주요 불만 요소가 적음",
  GUIDE_MTR_SR_T1_3: "초록",
  GUIDE_MTR_SR_T2_1: "70~79%",
  GUIDE_MTR_SR_T2_2: "대체로 긍정적 — 일부 불만 존재하나 호평 우세",
  GUIDE_MTR_SR_T2_3: "연두",
  GUIDE_MTR_SR_T3_1: "40~69%",
  GUIDE_MTR_SR_T3_2: "복합적 — 긍부정 의견이 혼재, 특정 문제 주목 필요",
  GUIDE_MTR_SR_T3_3: "주황",
  GUIDE_MTR_SR_T4_1: "39% 이하",
  GUIDE_MTR_SR_T4_2: "부정적 — 광범위한 불만 또는 구조적 문제 가능성",
  GUIDE_MTR_SR_T4_3: "빨강",
  GUIDE_MTR_SR_INFO: "주의: 헤더의 긍정률은 Steam 전체 누적 평가가 아닌 가장 최근 이벤트 구간의 긍정률입니다. 최근 업데이트 이후의 반응을 반영합니다. Steam 스토어 페이지의 종합 평가와 다를 수 있습니다.",
  GUIDE_MTR_H_CCU: "CCU (Current Concurrent Users)",
  GUIDE_MTR_CCU_L1: "Steam API를 매 시간 정각에 호출한 실시간 동접자 수입니다.",
  GUIDE_MTR_CCU_L2: "할인 기간(주황 배경)과 무료 주말(초록 배경)이 차트에 표시됩니다.",
  GUIDE_MTR_CCU_L3: "Peak CCU는 SteamSpy에서 수집한 역대 최대 동접자 추정치입니다.",
  GUIDE_MTR_CCU_L4: "게임 등록 이전 기간의 CCU는 SteamDB CSV를 업로드해 보정할 수 있습니다.",
  GUIDE_MTR_H_LANG: "언어 분포",
  GUIDE_MTR_LANG_L1: "RAW 리뷰 전체(수집된 모든 리뷰)의 언어 분포를 보여줍니다.",
  GUIDE_MTR_LANG_L2: "파이 차트는 상위 5개 언어 + 기타로 표시됩니다.",
  GUIDE_MTR_LANG_L3: "리스트의 감성률/키워드는 AI가 분석한 언어(top 3)만 표시됩니다. 그 외는 '(미분석)'으로 표시됩니다.",
  GUIDE_MTR_LANG_L4: "Steam 리뷰는 영어 리뷰가 과대표집되는 경향이 있습니다. AI 언어권 교차 분석은 이를 감안해 실제 주력 권역을 추정합니다.",
  GUIDE_MTR_H_TIMELINE: "타임라인 카드 상태",
  GUIDE_MTR_TL_T1_1: "AI 분석 진행 전",
  GUIDE_MTR_TL_T1_2: "이 구간의 AI 분석이 아직 실행되지 않았습니다",
  GUIDE_MTR_TL_T2_1: "리뷰 부족 (N건)",
  GUIDE_MTR_TL_T2_2: "구간 내 리뷰가 ≤5건 — 통계적으로 의미 있는 분석 불가",
  GUIDE_MTR_TL_T3_1: "소수 리뷰",
  GUIDE_MTR_TL_T3_2: "분석은 되었으나 리뷰 수가 매우 적어 결과의 신뢰도가 낮습니다",
  GUIDE_MTR_TL_T4_1: "긍정률 배지",
  GUIDE_MTR_TL_T4_2: "클릭하면 패치 요약, 유저 반응, 대표 리뷰를 펼쳐볼 수 있습니다",

  // ── 데이터 한계 및 주의사항 ──────────────────────────────────────────
  GUIDE_LIM_INFO1: "Steam 리뷰 API 한계: Steam이 language=all 파라미터로 반환하는 총 리뷰 수가 실제보다 적게 표시되는 경우가 있습니다. 이 경우 수집 건수와 Steam 표시 건수가 불일치할 수 있습니다.",
  GUIDE_LIM_INFO2: "리뷰 수정 미반영: 유저가 리뷰를 수정해도 recommendationid는 변경되지 않으므로 최초 수집 시점의 리뷰 내용이 보존됩니다.",
  GUIDE_LIM_INFO3: "삭제 리뷰 잔존: 수집 이후 삭제된 리뷰는 RAW 시트에 계속 남습니다. Steam이 삭제 신호를 별도 제공하지 않습니다.",
  GUIDE_LIM_INFO4: "CCU 공백 구간: 게임 등록 이전 기간 및 시스템 다운 기간은 CCU 수집이 불가합니다. SteamDB CSV를 업로드해 공백을 보정할 수 있습니다.",
  GUIDE_LIM_INFO5: "AI 분석 신뢰도: AI 분석 결과는 수집된 리뷰 샘플 기반의 통계적 추정이며 모든 유저 의견을 반영하지 않습니다. 특히 리뷰 수가 적은 구간(sparse)은 결과 신뢰도가 낮습니다.",
  GUIDE_LIM_INFO6: "content 잘림: 이벤트 본문이 5,000자를 초과하면 잘립니다. 패치노트의 하위 항목이 AI 요약에서 누락될 수 있습니다.",
  GUIDE_LIM_H_ENGLISH: "영어 과대표집 문제",
  GUIDE_LIM_ENGLISH_DESC: "Steam 리뷰는 영어 리뷰 비율이 실제 플레이어 분포보다 높은 경향이 있습니다. 한국·중국·일본 게임도 영어 리뷰가 전체의 20~40%를 차지하는 경우가 흔합니다. 언어권별 감성률 분석 시 이 점을 감안해 해석하세요.",

  // ── 이용 안내 페이지 ─────────────────────────────────────────────────
  USAGE_PAGE_TITLE: "이용 안내",
  USAGE_PAGE_DESC: "대시보드를 처음 사용하는 분들을 위한 설명서입니다.",

  USAGE_H_SERVICE: "🎯 이 서비스는 무엇인가요?",
  USAGE_SERVICE_DESC: "Steam 게임의 업데이트 유저 반응, 동접자(CCU), 언어권 분포를 이벤트 타임라인에 맞춰 분석해주는 대시보드입니다. 개발사·퍼블리셔 관계자나 게임 시장 분석에 관심 있는 분들을 위해 설계됐습니다. 수집부터 AI 분석까지 대부분 자동으로 이루어지며, 하루에 한 번 업데이트됩니다.",

  USAGE_H_REGISTER: "📋 분석할 게임 등록하기",
  USAGE_REGISTER_L1: "홈 화면 검색창에 게임명, AppID, 또는 스팀 상점 URL을 입력합니다.",
  USAGE_REGISTER_L2: "검색 결과에서 [이 게임 분석 등록하기] 버튼을 클릭합니다.",
  USAGE_REGISTER_L3: "수집 대기열에 올라가며, 리뷰 수에 따라 보통 1~3일 후 분석이 완료됩니다.",
  USAGE_REGISTER_TIP1: "한글 게임명 검색은 결과가 부정확할 수 있습니다. 영문명이나 AppID 검색을 권장합니다.",
  USAGE_REGISTER_TIP2: "리뷰 수가 매우 많은 게임(10만 건 이상)은 수집에 더 오래 걸릴 수 있습니다. 대기열 화면에서 수집 진행 상황을 확인할 수 있습니다.",

  USAGE_H_DASHBOARD: "📊 대시보드 각 탭 보는 법",

  USAGE_H_HEADER: "헤더 (게임 상단 정보)",
  USAGE_HEADER_L1: "긍정률 뱃지는 Steam 전체 누적 평가가 아닌, 가장 최근 이벤트 이후 유저 반응입니다. 최신 업데이트에 대한 민심을 빠르게 확인하는 데 유용합니다.",
  USAGE_HEADER_L2: "현재 CCU는 실시간 동시 접속자 수이며, 역대 최고 기록 대비 비율로 함께 표시됩니다.",
  USAGE_HEADER_L3: "AI 현황 진단은 최근 이벤트·리뷰 데이터를 바탕으로 생성된 종합 요약입니다. 매일 새벽 자동 갱신됩니다.",

  USAGE_H_CCU: "글로벌 트래픽 (CCU) 탭",
  USAGE_CCU_L1: "시간 흐름에 따른 동시 접속자 수 변화를 확인할 수 있습니다.",
  USAGE_CCU_L2: "주황색 배경은 할인 기간, 초록색 배경은 무료 주말입니다. 이 기간에 CCU가 급등한다면 프로모션 효과로 해석됩니다.",
  USAGE_CCU_ADMIN: "게임 등록 전 기간의 CCU 공백이 있다면, 김무길에게 SteamDB CSV 업로드를 요청하세요. 차트 우측 상단 업로드 버튼을 통해 보정 데이터를 추가할 수 있습니다.",

  USAGE_H_SENTIMENT: "평가 추이 탭",
  USAGE_SENTIMENT_L1: "이벤트(업데이트, 패치 등)를 기준으로 나눈 각 구간의 긍정률 변화를 꺾은선 그래프로 보여줍니다.",
  USAGE_SENTIMENT_L2: "상단 언어 버튼으로 여러 언어권의 반응을 동시에 비교할 수 있습니다.",
  USAGE_SENTIMENT_TIP: "한국어 라인과 영어 라인이 반대 방향으로 움직인다면, 권역별로 업데이트에 대한 반응이 다르다는 신호입니다.",

  USAGE_H_LANGUAGE: "언어권별 분포 탭",
  USAGE_LANGUAGE_L1: "파이 차트: 수집된 전체 리뷰에서 언어권 분포를 보여줍니다. 상위 5개 언어 + 기타로 표시됩니다.",
  USAGE_LANGUAGE_L2: "리스트: 각 언어별 감성률, 핵심 키워드를 확인할 수 있습니다. 상위 3개 언어만 AI 분석이 수행되며, 나머지는 '미분석'으로 표시됩니다.",
  USAGE_LANGUAGE_L3: "하단의 AI 언어권 교차 분석은 실제 주력 플레이 권역과 언어권 간 반응 온도차를 진단합니다.",
  USAGE_LANGUAGE_TIP: "영어 리뷰 비율이 높아도 영미권 유저가 그만큼 많다는 뜻이 아닙니다. 영어로 리뷰를 남기는 비영미권 유저가 많기 때문입니다. AI 언어권 교차 분석이 이 점을 감안해 실제 권역을 추정해줍니다.",

  USAGE_H_TIMELINE: "📅 업데이트 히스토리(타임라인) 읽는 법",
  USAGE_TIMELINE_L1: "각 카드는 업데이트, 이벤트, 뉴스 1건을 나타냅니다. 클릭하면 패치 요약, 유저 반응 진단, 대표 리뷰를 확인할 수 있습니다.",
  USAGE_TIMELINE_L2: "파란 점: 공식 패치 / 회색 점: 외부 뉴스 / 초록 점: 무료 주말",
  USAGE_TIMELINE_L3: "'AI 분석 진행 전': 분석이 아직 실행되지 않았습니다. 매일 새벽 6시경 자동 갱신됩니다.",
  USAGE_TIMELINE_L4: "'리뷰 부족': 해당 기간에 수집된 리뷰 수가 너무 적어 분석 대상에서 제외됩니다. 정상적인 상태입니다.",
  USAGE_TIMELINE_TIP: "패치노트 카드에 보이는 AI 반응 요약은 해당 구간 리뷰 기반입니다. 상단의 'AI 평가 추이 종합 진단'은 여러 구간을 가로지르는 장기 흐름을 별도로 분석한 것입니다.",
  USAGE_TIMELINE_ADMIN: "Steam에서 잡히지 않는 서버 장애, 공지, 커뮤니티 이슈가 있다면 김무길에게 수동 이벤트 등록을 요청하거나, 이벤트 폼에서 직접 등록할 수 있습니다 (관리자 비밀번호 필요).",

  USAGE_H_SCHEDULE: "⏱️ 데이터 갱신 주기",
  USAGE_SCH_T1_1: "현재 CCU (동접자)",
  USAGE_SCH_T1_2: "매 시간 정각",
  USAGE_SCH_T1_3: "Steam API 직접 수집",
  USAGE_SCH_T2_1: "리뷰·뉴스 수집",
  USAGE_SCH_T2_2: "매일 새벽 5시경",
  USAGE_SCH_T2_3: "신규·미수집 게임 우선",
  USAGE_SCH_T3_1: "AI 분석 결과",
  USAGE_SCH_T3_2: "매일 새벽 6시경",
  USAGE_SCH_T3_3: "수집 완료 즉시 자동 트리거",
  USAGE_SCH_T4_1: "CCU 피크타임 분석",
  USAGE_SCH_T4_2: "매주 월요일",
  USAGE_SCH_T4_3: "비용 절감을 위해 주 1회",
  USAGE_SCH_TIP: "대시보드가 아직 어제 데이터를 보여준다면, 새벽 6시 이후에 페이지를 새로고침 해보세요. 캐시 갱신까지 최대 5분이 소요될 수 있습니다.",

  USAGE_H_ADMIN: "🔐 관리자 기능이 필요한 경우",
  USAGE_ADMIN_DESC: "아래 기능은 모두 관리자 비밀번호가 필요합니다. 김무길에게 문의하세요.",
  USAGE_ADMIN_T1_1: "AI 분석 새로고침",
  USAGE_ADMIN_T1_2: "대시보드 하단",
  USAGE_ADMIN_T1_3: "최신 패치·뉴스 재수집 후 AI 분석 재실행. 분석 결과가 오래됐거나 누락됐을 때",
  USAGE_ADMIN_T2_1: "SteamDB CSV 업로드",
  USAGE_ADMIN_T2_2: "CCU 탭 오른쪽",
  USAGE_ADMIN_T2_3: "등록 전 기간 CCU 공백 보정. SteamDB에서 CSV 다운로드 후 업로드",
  USAGE_ADMIN_T3_1: "수동 이벤트 등록",
  USAGE_ADMIN_T3_2: "업데이트 히스토리 폼",
  USAGE_ADMIN_T3_3: "Steam에 없는 이슈·이벤트를 타임라인에 추가",
  USAGE_ADMIN_T4_1: "이벤트 수정",
  USAGE_ADMIN_T4_2: "타임라인 카드 ✏️ 버튼",
  USAGE_ADMIN_T4_3: "이벤트 제목·유형·날짜 수정 및 재분석",
  USAGE_ADMIN_T5_1: "게임 삭제",
  USAGE_ADMIN_T5_2: "대시보드 하단",
  USAGE_ADMIN_T5_3: "홈 목록에서 숨기기. 수집 데이터는 보존됨",
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
