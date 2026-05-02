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
  NAV_BRAND: "🌾 스팀 정미소",
  NAV_GUIDE: "분석 방법 가이드",
  NAV_USAGE: "이용 안내",

  // ── 홈 페이지 ───────────────────────────────────────────────────────
  HOME_TITLE: "🌾 스팀 정미소",
  HOME_SUBTITLE: "업데이트 민심 · 트래픽 · 언어권 반응을 한눈에 꿰뚫는 스팀 분석 대시보드",

  // ── 검색창 ──────────────────────────────────────────────────────────
  SEARCH_SECTION_TITLE: "게임 등록",
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
  REGISTER_SUCCESS: "{name} 등록 완료! 분석이 시작됩니다.",
  REGISTER_ERROR: "등록 중 오류가 발생했습니다.",
  REGISTER_QUOTA_EXCEEDED: "곳간 용량 부족! 농장주(김무길)에게 곳간을 늘려달라고 하세요.",
  REGISTER_APPROVAL_NOTICE: "페이지 생성 후 AI 분석은 관리자 승인 이후 진행됩니다. 수집이 완료되면 대기열에서 진행 상황을 확인할 수 있습니다.",

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
  GAMES_SECTION_TITLE: "전체 게임",
  GAMES_EMPTY_ICON: "🎮",
  GAMES_EMPTY_TITLE: "아직 등록된 게임이 없습니다.",
  GAMES_EMPTY_SUBTITLE: "위 검색창에서 Steam 게임을 검색하고 등록해 보세요.",
  PENDING_GAMES_SECTION_TITLE: "분석 진행 중인 게임",
  COUNT_SUFFIX: "개",

  // ── 플로팅 네비게이션 (FloatingNav) ─────────────────────────────────
  FLOATING_NAV_BTN:   "게임 등록하기",
  FLOATING_NAV_TITLE: "스팀 게임 검색하고 등록하기",

  // ── 검색 모달 추가 텍스트 (SearchModal) ──────────────────────────────
  SEARCH_LOADING_TEXT: "Steam에서 검색 중…",
  SEARCH_NO_RESULTS:   "검색 결과가 없습니다. 다른 검색어나 AppID를 시도해 보세요.",
  SEARCH_ERROR:        "검색 중 오류가 발생했습니다.",
  SEARCH_SERVER_ERROR: "서버 연결 오류",
  EARLY_ACCESS_BADGE:      "얼리 액세스",
  ALREADY_REGISTERED_BADGE: "✓ 이미 등록된 게임",
  ALREADY_REGISTERED_BTN:   "이미 등록된 게임",

  // ── 홈 인사이트 패널 (HomeInsightPanel / EventSection / RateSection) ──
  INSIGHT_SHIFT_TITLE:  "⚡ 평가 급변",
  INSIGHT_SHIFT_EMPTY:  "최근 60일 내 급변 없음",
  SHIFT_DECLINE_LABEL:  "📉 급락",
  SHIFT_RECOVERY_LABEL: "📈 회복",
  INSIGHT_EVENT_TITLE:  "🔔 이벤트 감지",
  INSIGHT_EVENT_RECENT: "최근 2주",
  INSIGHT_EVENT_EMPTY:  "최근 14일 내 이벤트 없음",
  INSIGHT_RATE_TITLE:   "📊 긍정률",
  RATE_SORT_DESC:       "높은순",
  RATE_SORT_ASC:        "낮은순",
  RATE_SHOW_MORE:       "+{n}개 더보기 ▼",
  RATE_COLLAPSE:        "접기 ▲",

  // ── 상대 시간 표현 ────────────────────────────────────────────────────
  REL_TODAY:      "오늘",
  REL_DAYS_AGO:   "{n}일 전",
  REL_WEEKS_AGO:  "{n}주 전",
  REL_MONTHS_AGO: "{n}개월 전",

  // ── 게임 카드 ───────────────────────────────────────────────────────
  CARD_REVIEWS_LABEL: "리뷰 {n}건",
  CARD_EVENTS_LABEL: "이벤트 {n}건",
  CARD_DAYS_AGO: "{n}일 전 업데이트",
  CARD_LAST_EVENT_LABEL: "최근 이벤트",
  CARD_AI_DATE_LABEL: "AI 분석",
  CARD_RECENT_EVENT_LABEL: "최근 이벤트",

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

  // ── SteamSpy 통계 ────────────────────────────────────────────────────────
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

  // ── 게임 헤더 메타 레이블 ────────────────────────────────────────────────
  HEADER_METACRITIC_LABEL: "비평가 점수",
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
  BADGE_AI_UNAPPROVED: "AI 미승인",

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
  TIMELINE_TYPE_OFFICIAL: "공식 이벤트",
  TIMELINE_TYPE_MANUAL: "수동 이벤트",
  TIMELINE_TYPE_NEWS: "외부 이벤트",
  TIMELINE_TYPE_FREE_WEEKEND: "무료 주말",
  TIMELINE_TYPE_LAUNCH: "런칭",
  TIMELINE_SALE_TEXT: "할인 중",
  TIMELINE_MONTH_NO_EVENTS: "이번 달 등록된 이벤트가 없습니다.",
  TIMELINE_PATCH_SUMMARY: "패치 내용 요약",
  TIMELINE_REACTION: "유저 반응 진단",
  TIMELINE_REVIEW_COUNT: "해당 구간 수집 리뷰: {n}건",
  TIMELINE_TOP_REVIEWS: "핵심 대표 리뷰",
  TIMELINE_PATCH_NOTES_LINK: "공식 패치노트 원문 보기 ↗",
  REVIEW_POSITIVE: "긍정",
  REVIEW_NEGATIVE: "부정",

  // ── 이벤트 등록 폼 ──────────────────────────────────────────────────
  EVENT_FORM_TOGGLE: "수동 이슈/이벤트 등록",
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
  REANALYZE_SUCCESS: "분석 새로고침이 요청됐습니다. 뉴스·패치 재수집 후 AI 분석이 시작됩니다. 완료까지 수 분~수십 분 소요될 수 있습니다.",
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
  GUIDE_SCH_INFO1: "AI 분석(analyze.yml)은 매월 1일 00:00 UTC에 자동 실행됩니다. 관리자 패널에서 게임별로 '이번 달' 또는 '재분석' 버튼을 눌러 온디맨드로 즉시 트리거할 수도 있습니다. 각 게임 페이지의 'AI 분석 새로고침' 버튼은 reanalyze.yml을 트리거해 뉴스·패치 재수집(NEWS_ONLY) → 60초 대기 → AI 분석 순으로 실행됩니다. 신규 게임은 관리자 승인 후 첫 분석이 실행됩니다.",
  GUIDE_SCH_INFO2: "CCU AI 피크타임 분석과 언어권 교차 분석은 매월 1일에 갱신됩니다. 동일 패턴 데이터에서 동일한 분석이 매일 반복 생성되는 비용 낭비를 방지하기 위한 조건부 실행입니다. 감성 추이 종합 진단은 신규 버킷이 작성된 경우에만 갱신됩니다.",
  GUIDE_SCH_T1_1: "collect.yml",
  GUIDE_SCH_T1_2: "매일 20:00 UTC",
  GUIDE_SCH_T1_3: "익일 05:00",
  GUIDE_SCH_T1_4: "리뷰 수집, 뉴스/이벤트 수집, 메타데이터 갱신",
  GUIDE_SCH_T2_1: "analyze.yml",
  GUIDE_SCH_T2_2: "매월 1일 00:00 UTC + 온디맨드",
  GUIDE_SCH_T2_3: "관리자 승인 게임만",
  GUIDE_SCH_T2_4: "월별 AI 분석(monthly_summary), 브리핑 갱신. 관리자 패널에서 즉시 트리거 가능",
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
  GUIDE_NEWS_CLS_T1_1: "official (공식 이벤트)",
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
  GUIDE_BKT_DESC: "이벤트를 YYYY-MM 월 단위로 묶어 분석합니다. 각 월 버킷에는 해당 기간에 작성된 Steam 리뷰와 공식 이벤트가 배정됩니다.",
  GUIDE_BKT_T1_1: "월 버킷 범위",
  GUIDE_BKT_T1_2: "해당 월 1일 00:00 UTC ~ 말일 23:59:59 UTC (현재 월은 분석 시점까지)",
  GUIDE_BKT_T2_1: "현재 월 버킷",
  GUIDE_BKT_T2_2: "항상 재분석 대상 — 이벤트·리뷰가 계속 추가되기 때문",
  GUIDE_BKT_T3_1: "과거 월 버킷",
  GUIDE_BKT_T3_2: "monthly_summary 행에 sentiment_rate가 채워진 경우 건너뜀 (이미 완료)",
  GUIDE_BKT_T4_1: "뉴스 이벤트(news)",
  GUIDE_BKT_T4_2: "타임라인에 표시되지만 AI 패치 요약 대상에서 제외 — 공식/수동 이벤트만 종합 요약",
  GUIDE_BKT_T5_1: "수동 이벤트 추가 시",
  GUIDE_BKT_T5_2: "해당 월 재분석 대상에 포함 — AI 분석 새로고침(reanalyze-game) 또는 다음 월별 자동 분석",
  GUIDE_BKT_H_REANALYZE: "월별 패치 요약 방식",
  GUIDE_BKT_REANALYZE_DESC: "한 달 내 공식 이벤트 전체를 하나의 프롬프트로 종합해 월간 패치 요약을 생성합니다. 이벤트가 많아질수록 AI 호출 횟수가 폭증하던 이전 구조를 개선해 비용을 크게 절감합니다.",
  GUIDE_BKT_H_SPARSE: "스파스(sparse) 월",
  GUIDE_BKT_SPARSE_DESC: "월 내 리뷰 수 ≤ 5건이면 감성 AI 분석을 생략하고 sparse로 표시합니다. 공식 이벤트가 있는 경우 패치 요약은 리뷰 없이도 생성합니다.",

  // ── AI 분석 상세 ─────────────────────────────────────────────────────
  GUIDE_AI_H_MODEL: "모델 및 공통 원칙",
  GUIDE_AI_MODEL_L1: "모델: Google Gemini 2.5 Flash",
  GUIDE_AI_MODEL_L2: "Thinking 모드 활성 (thinking_budget=512 토큰): 감성 분석·인과관계 판단 전에 내부 추론 과정을 거쳐 분석 품질을 높입니다.",
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
  GUIDE_AI_S2_NOTE: "분석 범위: 전체(all) + top 5 언어 각각 → 월당 최대 6회 Gemini 호출 (언어 수 기준)",
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
  GUIDE_AI_S5_DESC: "전체 CCU 데이터를 KST 기준 24시간 평균으로 집약한 뒤, 피크 시간대 패턴으로 주력 플레이 권역을 추정합니다. 매월 1일 갱신됩니다.",
  GUIDE_AI_H6: "⑥ 언어권 교차 분석 (generate_language_cross_analysis)",
  GUIDE_AI_S6_DESC: "RAW 리뷰 전체의 언어 분포와 각 언어별 평균 감성률을 종합합니다. Steam 영어 과대표집 문제를 감안해 실제 주력 권역과 권역 간 평가 온도차를 진단합니다. 매월 1일 자동 갱신되며, 즉시 재분석을 희망할 경우 관리자에게 문의하세요.",
  GUIDE_AI_H7: "⑦ AI 브리핑 (generate_ai_briefing)",
  GUIDE_AI_S7_DESC: "최근 10개 구간의 날짜·제목·긍정률·리뷰수·요약을 종합하고 최근 3건 vs 이전 3건 추이 방향을 계산한 뒤, 게임 전반 현황을 3~5문장으로 진단합니다. 매월 1일 또는 온디맨드 분석 시 갱신됩니다.",
  GUIDE_AI_INFO: "분석 언어 수: 상위 5개 언어에 대해 언어별 감성 분석이 수행됩니다. 나머지 언어는 리뷰 분포(파이 차트)에는 표시되지만 AI 감성 분석 데이터는 없습니다. 언어 수를 늘리면 Gemini API 비용이 언어 수 × 이벤트 수만큼 증가합니다.",

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
  GUIDE_MTR_CCU_L2: "최근 30일 / 90일 / 전체 범위로 전환할 수 있으며, 각 범위에서 Y축이 자동 스케일됩니다.",
  GUIDE_MTR_CCU_L3: "Peak CCU는 역대 최대 동접자 수이며 헤더에 현재 CCU 대비 비율로 표시됩니다.",
  GUIDE_MTR_CCU_L4: "게임 등록 이전 기간의 CCU는 SteamDB CSV를 업로드해 보정할 수 있습니다.",
  GUIDE_MTR_H_LANG: "언어 분포",
  GUIDE_MTR_LANG_L1: "RAW 리뷰 전체(수집된 모든 리뷰)의 언어 분포를 보여줍니다.",
  GUIDE_MTR_LANG_L2: "파이 차트는 상위 5개 언어 + 기타로 표시됩니다.",
  GUIDE_MTR_LANG_L3: "리스트의 감성률/키워드는 AI가 분석한 언어(top 5)만 표시됩니다. 그 외는 '(미분석)'으로 표시됩니다.",
  GUIDE_MTR_LANG_L4: "Steam 리뷰는 영어 리뷰가 과대표집되는 경향이 있습니다. AI 언어권 교차 분석은 이를 감안해 실제 주력 권역을 추정합니다.",
  GUIDE_MTR_H_TIMELINE: "타임라인 카드 상태",
  GUIDE_MTR_TL_T1_1: "AI 분석 전",
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
  USAGE_SERVICE_DESC: "Steam 게임의 업데이트 유저 반응, 동접자(CCU), 언어권 분포를 월별 타임라인에 맞춰 분석해주는 대시보드입니다. 리뷰·뉴스는 매일 수집되며, AI 분석은 매월 자동으로 이루어집니다.",

  USAGE_H_REGISTER: "📋 분석할 게임 등록하기",
  USAGE_REGISTER_L1: "홈 화면 검색창에 게임명, AppID, 또는 스팀 상점 URL을 입력합니다.",
  USAGE_REGISTER_L2: "검색 결과에서 [이 게임 분석 등록하기] 버튼을 클릭합니다.",
  USAGE_REGISTER_L3: "수집이 완료되면 즉시 게임 페이지가 발행됩니다. AI 분석은 관리자(김무길) 승인 후 별도로 진행됩니다.",
  USAGE_REGISTER_TIP1: "한글 게임명 검색은 결과가 부정확할 수 있습니다. 영문명이나 AppID 검색을 권장합니다.",
  USAGE_REGISTER_TIP2: "리뷰 수가 매우 많은 게임(10만 건 이상)은 수집에 더 오래 걸릴 수 있습니다. 대기열 화면에서 수집 진행 상황을 확인할 수 있습니다.",

  USAGE_H_DASHBOARD: "📊 대시보드 각 탭 보는 법",

  USAGE_H_HEADER: "헤더 (게임 상단 정보)",
  USAGE_HEADER_L1: "Steam 전체 누적 평가를 우선 표시하고, 없을 때만 최근 이벤트 기반 rate로 표기합니다.",
  USAGE_HEADER_L2: "현재 CCU는 실시간 동시 접속자 수이며, 역대 최고 기록 대비 비율로 함께 표시됩니다.",
  USAGE_HEADER_L3: "AI 현황 진단은 최근 이벤트·리뷰 데이터를 바탕으로 생성된 종합 요약입니다. 매월 1일 자동 갱신되며, 각 게임 페이지의 'AI 분석 새로고침' 버튼이나 관리자 패널에서 즉시 실행할 수 있습니다.",

  USAGE_H_CCU: "글로벌 트래픽 (CCU) 탭",
  USAGE_CCU_L1: "시간 흐름에 따른 동시 접속자 수 변화를 확인할 수 있습니다. 최근 30일 / 90일 / 전체 범위로 전환할 수 있습니다.",
  USAGE_CCU_L2: "범위별로 Y축이 자동 스케일되므로, 런칭 초반 피크 때문에 최근 수치가 일직선으로 보이는 문제가 없습니다.",
  USAGE_CCU_ADMIN: "게임 등록 전 기간의 CCU 공백이 있다면, 글로벌 트래픽 탭 하단 업로드 버튼을 통해 SteamDB CSV 보정 데이터를 추가할 수 있습니다 (관리자 비밀번호 필요).",

  USAGE_H_SENTIMENT: "평가 추이 탭",
  USAGE_SENTIMENT_L1: "월 단위로 나눈 각 구간의 긍정률 변화를 꺾은선 그래프로 보여줍니다. 각 구간에 속한 공식 이벤트가 있으면 그래프 위에 표시됩니다.",
  USAGE_SENTIMENT_L2: "상단 언어 버튼으로 여러 언어권의 반응을 동시에 비교할 수 있습니다.",
  USAGE_SENTIMENT_TIP: "한국어 라인과 영어 라인이 반대 방향으로 움직인다면, 권역별로 업데이트에 대한 반응이 다르다는 신호입니다.",

  USAGE_H_LANGUAGE: "언어권별 분포 탭",
  USAGE_LANGUAGE_L1: "파이 차트: 수집된 전체 리뷰에서 언어권 분포를 보여줍니다. 상위 5개 언어 + 기타로 표시됩니다.",
  USAGE_LANGUAGE_L2: "리스트: 각 언어별 감성률, 핵심 키워드를 확인할 수 있습니다. 상위 5개 언어에 대해 AI 분석이 수행되며, 나머지는 '미분석'으로 표시됩니다.",
  USAGE_LANGUAGE_L3: "하단의 AI 언어권 교차 분석은 실제 주력 플레이 권역과 언어권 간 반응 온도차를 진단합니다.",
  USAGE_LANGUAGE_TIP: "영어 리뷰 비율이 높아도 영미권 유저가 그만큼 많다는 뜻이 아닙니다. 영어로 리뷰를 남기는 비영미권 유저가 많기 때문입니다. AI 언어권 교차 분석이 이 점을 감안해 실제 권역을 추정해줍니다.",

  USAGE_H_TIMELINE: "📅 업데이트 히스토리(타임라인) 읽는 법",
  USAGE_TIMELINE_L1: "각 카드는 업데이트, 이벤트, 뉴스 1건을 나타냅니다. 클릭하면 패치 요약, 유저 반응 진단, 대표 리뷰를 확인할 수 있습니다.",
  USAGE_TIMELINE_L2: "파란 점: 공식 이벤트 / 회색 점: 외부 뉴스 / 초록 점: 무료 주말",
  USAGE_TIMELINE_L3: "'AI 분석 전': 분석이 아직 실행되지 않았습니다. 매월 1일 자동 갱신되며, 각 게임 페이지의 'AI 분석 새로고침' 버튼이나 관리자 패널에서 즉시 실행할 수 있습니다.",
  USAGE_TIMELINE_L4: "'리뷰 부족': 해당 기간에 수집된 리뷰 수가 너무 적어 분석 대상에서 제외됩니다. 정상적인 상태입니다.",
  USAGE_TIMELINE_TIP: "패치노트 카드에 보이는 AI 반응 요약은 해당 구간 리뷰 기반입니다. 상단의 'AI 평가 추이 종합 진단'은 여러 구간을 가로지르는 장기 흐름을 별도로 분석한 것입니다.",
  USAGE_TIMELINE_ADMIN: "Steam에서 잡히지 않는 서버 장애, 공지, 커뮤니티 이슈가 있다면 각 게임 페이지 타임라인 하단 🔒 버튼을 클릭해 직접 등록할 수 있습니다 (관리자 비밀번호 필요).",

  USAGE_H_SCHEDULE: "⏱️ 데이터 갱신 주기",
  USAGE_SCH_T1_1: "현재 CCU (동접자)",
  USAGE_SCH_T1_2: "매 시간 정각",
  USAGE_SCH_T1_3: "Steam API 직접 수집",
  USAGE_SCH_T2_1: "리뷰·뉴스 수집",
  USAGE_SCH_T2_2: "매일 새벽 5시경",
  USAGE_SCH_T2_3: "신규·미수집 게임 우선",
  USAGE_SCH_T3_1: "AI 분석 결과",
  USAGE_SCH_T3_2: "매월 1일 + 온디맨드",
  USAGE_SCH_T3_3: "관리자 승인 게임만 실행. 관리자 패널에서 즉시 트리거 가능",
  USAGE_SCH_T4_1: "CCU 피크타임·언어권 교차 분석",
  USAGE_SCH_T4_2: "매월 1일",
  USAGE_SCH_T4_3: "동일 데이터 반복 생성 방지를 위해 월 1회 갱신",
  USAGE_SCH_TIP: "AI 분석은 매월 1일 자동 실행되며, 관리자 패널에서 언제든 온디맨드로 트리거할 수 있습니다. 페이지 캐시 갱신까지 최대 5분이 소요될 수 있습니다.",

  USAGE_H_ADMIN: "🔐 관리자 기능이 필요한 경우",
  USAGE_ADMIN_DESC: "아래 기능은 모두 관리자 비밀번호가 필요합니다. 김무길에게 문의하세요. 대부분의 관리 기능은 관리자 패널(/admin)에서 처리됩니다.",
  USAGE_ADMIN_T1_1: "AI 분석 승인·재분석·게임 삭제/복원",
  USAGE_ADMIN_T1_2: "관리자 패널 (/admin)",
  USAGE_ADMIN_T1_3: "신규 게임 AI 승인, 이번 달 수집+분석, 전체 재분석, 게임 숨기기/복원을 게임별로 처리",
  USAGE_ADMIN_T2_1: "SteamDB CSV 업로드",
  USAGE_ADMIN_T2_2: "CCU 탭 하단",
  USAGE_ADMIN_T2_3: "등록 전 기간 CCU 공백 보정. SteamDB에서 CSV 다운로드 후 업로드",
  USAGE_ADMIN_T3_1: "수동 이벤트 등록",
  USAGE_ADMIN_T3_2: "게임 페이지 타임라인 하단 🔒 버튼",
  USAGE_ADMIN_T3_3: "Steam에 없는 이슈·이벤트를 타임라인에 추가. 클릭 시 팝업으로 등록 폼이 열림",
  USAGE_ADMIN_T4_1: "이벤트 수정",
  USAGE_ADMIN_T4_2: "타임라인 카드 ✏️ 버튼",
  USAGE_ADMIN_T4_3: "이벤트 제목·유형·날짜 수정 및 재분석 트리거",
  USAGE_ADMIN_T5_1: "UI 텍스트 관리",
  USAGE_ADMIN_T5_2: "관리자 패널 (/admin)",
  USAGE_ADMIN_T5_3: "이 서비스에 표시되는 문구를 Google Sheets에서 직접 수정할 수 있습니다",

  // ── 내비게이션 공통 ──────────────────────────────────────────────────
  NAV_ADMIN: "🔒 관계자외 출입금지",
  NAV_HOME: "← 홈으로",
  NAV_GUIDE_BACK: "← 분석 방법 가이드",

  // ── 인라인 레이블 ────────────────────────────────────────────────────
  LABEL_TIP: "💡 Tip",
  LABEL_ADMIN_FUNC: "🔐 관리자 기능",

  // ── 테이블 헤더 ─────────────────────────────────────────────────────
  TH_COMPONENT: "구성 요소",
  TH_ROLE: "역할",
  TH_TECH: "기술",
  TH_WORKFLOW: "워크플로우",
  TH_CYCLE: "실행 주기",
  TH_KST: "KST 기준",
  TH_MAIN_TASK: "주요 작업",
  TH_PARAM: "파라미터",
  TH_VALUE: "값",
  TH_REASON: "이유",
  TH_SOURCE: "소스",
  TH_API: "API",
  TH_COLLECT_CONTENT: "수집 내용",
  TH_CLASS: "분류",
  TH_CRITERIA: "기준",
  TH_DISPLAY: "표시",
  TH_CONDITION: "조건",
  TH_PROCESS: "처리",
  TH_OUT_FIELD: "출력 필드",
  TH_CONTENT: "내용",
  TH_PATCH_TYPE: "판별 유형",
  TH_SUMMARY_WAY: "요약 방식",
  TH_RANGE: "범위",
  TH_INTERPRET: "해석",
  TH_BADGE_COLOR: "배지 색상",
  TH_STATUS: "상태",
  TH_MEANING: "의미",
  TH_DATA_KIND: "데이터 종류",
  TH_KST_TIME: "갱신 시간 (KST)",
  TH_NOTE: "비고",
  TH_FEATURE: "기능",
  TH_LOCATION: "위치",
  TH_FUNC_DESC: "설명",

  // ── 관리자 패널 ─────────────────────────────────────────────────────
  ADMIN_HELP_BTN_TITLE: "도움말",
  ADMIN_PAGE_TITLE: "🔧 관리자 패널",
  ADMIN_PAGE_SUBTITLE: "전체 게임 현황 관리 및 시스템 설정",
  ADMIN_SECTION_GAMES: "전체 게임 현황",
  ADMIN_SECTION_TOOLS: "시스템 도구",
  ADMIN_COL_GAME: "게임",
  ADMIN_COL_STATUS: "상태",
  ADMIN_COL_AI_APPROVED: "AI 승인",
  ADMIN_COL_REVIEWS: "수집 대상 / Steam 총계",
  ADMIN_COL_ORDER: "순서",
  ADMIN_COL_LAST_ANALYSIS: "마지막 분석",
  ADMIN_COL_ACTION: "액션",
  ADMIN_STATUS_ACTIVE: "활성",
  ADMIN_STATUS_COLLECTING: "수집 중",
  ADMIN_STATUS_ARCHIVED: "숨김",
  ADMIN_STATUS_ERROR: "수집 오류",
  ADMIN_BTN_APPROVE_AI: "✅ AI 승인",
  ADMIN_BTN_APPROVED: "✅ 승인됨",
  ADMIN_BTN_UNAPPROVED: "⏳ 미승인",
  ADMIN_BTN_THIS_MONTH: "📅 이번 달",
  ADMIN_BTN_REANALYZE: "🔄 재분석",
  ADMIN_BTN_HIDE: "🗑️ 숨기기",
  ADMIN_BTN_RESTORE: "↩️ 복원",
  ADMIN_BTN_CONFIRM: "확인",
  ADMIN_BTN_CANCEL: "취소",
  ADMIN_PENDING_WARNING: "⚠️ AI 분석 미승인 게임 {n}개 — AI 승인 셀을 클릭해 게임별로 ON/OFF 설정하세요.",
  ADMIN_LOGIN_TITLE: "🔒 관계자외 출입금지",
  ADMIN_LOGIN_DESC: "관리자 비밀번호를 입력하세요.",
  ADMIN_LOGIN_BTN: "입장",
  ADMIN_LOGIN_LOADING: "확인 중...",
  ADMIN_TOOL_SYNC_TITLE: "UI 텍스트 동기화",
  ADMIN_TOOL_SYNC_DESC: "코드에 새로 추가된 UI 문구 키를 Google Sheets에 반영합니다. 기존 커스텀 번역은 그대로 유지됩니다.",
  ADMIN_TOOL_SYNC_NOTE: "새 UI 문구나 언어 추가 후 실행하세요.",
  ADMIN_TOOL_SYNC_BTN: "동기화 실행",
  ADMIN_TOOL_ANALYZE_TITLE: "미분석 이벤트 AI 분석",
  ADMIN_TOOL_ANALYZE_DESC: "이벤트 수집은 완료됐지만 AI 분석이 아직 실행되지 않은 구간만 선별해 전체 게임을 대상으로 일괄 분석합니다.",
  ADMIN_TOOL_ANALYZE_NOTE: "뉴스 재수집 없이 분석만 실행됩니다.",
  ADMIN_TOOL_ANALYZE_BTN: "분석 시작",
  ADMIN_TOOL_COLLECT_TITLE: "수집 재시작",
  ADMIN_TOOL_COLLECT_DESC: "GitHub Actions 수집 워크플로우를 수동으로 재트리거합니다. 수집 대기열에 게임이 있는데 Action이 오류로 멈춘 경우 사용하세요.",
  ADMIN_TOOL_COLLECT_BTN: "수집 재시작",
  ADMIN_SYNC_MODAL_TITLE: "UI 텍스트 시트 관리",
  ADMIN_SYNC_MODAL_SYNC: "동기화: 누락 키만 추가, 기존 커스텀 값 보존",
  ADMIN_SYNC_MODAL_RESET: "전체 재설정: 미사용 키 제거, 커스텀 값은 유지",
  ADMIN_SYNC_MODAL_FORCE: "강제 초기화: 코드 기본값으로 전체 덮어씀 (커스텀 값 포함)",
  ADMIN_SYNC_BTN_SYNC: "동기화",
  ADMIN_SYNC_BTN_RESET: "재설정",
  ADMIN_SYNC_BTN_FORCE: "⚠️ 강제 초기화 (코드 기본값으로 전체 덮어쓰기)",
  ADMIN_SYNC_BTN_CANCEL: "취소",
  ADMIN_RETRIGGER_MODAL_TITLE: "수집 재시작",
  ADMIN_RETRIGGER_MODAL_DESC: "수집에 실패한 대기열 게임들의 GitHub Action을 다시 트리거합니다.",
  ADMIN_RETRIGGER_BTN: "재시작",
  ADMIN_TOAST_APPROVE: "AI 분석 승인 완료. 곧 분석이 시작됩니다.",
  ADMIN_TOAST_UNAPPROVE: "AI 분석 승인이 취소되었습니다.",
  ADMIN_TOAST_HIDE: "게임을 숨겼습니다. 데이터는 보존됩니다.",
  ADMIN_TOAST_RESTORE: "게임을 복원했습니다.",
  ADMIN_TOAST_MONTH: "이번 달 수집+분석을 시작했습니다. 수분 내 반영됩니다.",
  ADMIN_TOAST_REANALYZE: "AI 재분석을 요청했습니다. 수분 내 반영됩니다.",
  ADMIN_TOAST_ANALYZE_PENDING: "미분석 이벤트 AI 분석을 시작했습니다. 수분 내 반영됩니다.",
  ADMIN_TOAST_RETRIGGER: "수집 워크플로우를 재시작했습니다. 수분 내 진행됩니다.",
  ADMIN_TOAST_SORT_ORDER: "표시 순서가 저장되었습니다.",
  ADMIN_TOAST_SYNC: "동기화 완료 — 추가 {added}건 / 기존 유지 {skipped}건",
  ADMIN_TOAST_RESET: "재설정 완료 — 유지 {kept}건 / 추가 {added}건 / 제거 {removed}건",
  ADMIN_TOAST_FORCE: "강제 초기화 완료 — 코드 기본값으로 전체 덮어쓰기 ({added}건)",

  // ── 게임 헤더 추가 ───────────────────────────────────────────────────────
  HEADER_RATE_LABEL_STEAM: "Steam 전체 누적 평가 기준",
  HEADER_RATE_LABEL_RECENT: "최근 이벤트 구간 기준",

  // ── CCU 차트 ─────────────────────────────────────────────────────────────
  CCU_VIEW_LINE: "꺾은선",
  CCU_VIEW_HEATMAP: "히트맵",
  CCU_HEATMAP_HOW_TO_READ: "읽는 법",
  CCU_HEATMAP_GUIDE: "행 = 요일, 열 = 시간(KST) · 색이 진할수록 해당 시간대 평균 동접자가 높음 · 칸에 마우스를 올리면 평균 CCU 수치를 확인할 수 있습니다",
  CCU_HEATMAP_NO_DATA_LEGEND: "데이터 없음",
  CCU_HEATMAP_LOW: "낮음",
  CCU_HEATMAP_HIGH: "높음",
  CCU_HEATMAP_PEAK: "최고치",
  CCU_HEATMAP_TOOLTIP_AVG: "평균 CCU:",
  CCU_HEATMAP_TOOLTIP_NO_DATA: "데이터 없음",
  CCU_HEATMAP_FOOTER: "전체 수집 기간 데이터 기반 · 동접자 최고치",
  CCU_HEATMAP_FOOTER_SUFFIX: "(테두리 셀)",
  CCU_VIEW_ALL: "전체",
  CCU_VIEW_90D: "최근 90일",
  CCU_VIEW_30D: "최근 30일",
  CCU_NO_DATA: "CCU 데이터가 없습니다.",
  CCU_NO_DATA_PERIOD: "해당 기간 CCU 데이터가 없습니다.",
  CCU_SCROLL_HINT: "← 스크롤로 이전 데이터 확인",
  CCU_TOOLTIP_UNIT: "명",
  CCU_PEAKTIME_LABEL: "AI 피크타임 분석",
  CCU_HOUR_SUFFIX: "시",

  // ── CCU 관리자 패널 ──────────────────────────────────────────────────────
  CSV_UPLOAD_BTN: "SteamDB CSV 업로드",
  CSV_UPLOADING: "업로드 중...",
  CSV_MODAL_TITLE: "SteamDB CCU CSV 업로드",
  CSV_SELECTED_FILE: "선택된 파일:",
  CSV_GAME_ONLY: "현재 게임({name})에만 적용됩니다.",
  CSV_UPLOAD_CONFIRM: "업로드",
  CSV_CANCEL: "취소",
  CSV_AUTH_TITLE: "CSV 업로드 인증",
  CSV_AUTH_DESC: "SteamDB CCU CSV 업로드는 관리자만 가능합니다.",
  CSV_SUCCESS: "{count}건 병합 완료",

  // ── 홈 KPI 지표 ─────────────────────────────────────────────────────────
  KPI_GAMES_LABEL:        "분석 완료",
  KPI_SHIFTS_LABEL:       "최근 급변",
  KPI_UPDATES_LABEL:      "최근 업데이트",
  KPI_AVG_RATE_LABEL:     "평균 긍정률",

  // ── 홈 인사이트 섹션 ────────────────────────────────────────────────────
  INSIGHT_SHIFT_DECLINE:  "📉 급락",
  INSIGHT_SHIFT_RECOVERY: "📈 회복",
  INSIGHT_UPDATE_TITLE:   "🔧 최근 주요 업데이트",
  INSIGHT_RATE_UP:        "↑ 상승 중",
  INSIGHT_RATE_DOWN:      "↓ 하락 중",
  INSIGHT_RATE_STABLE:    "→ 안정",

  // ── 언어 탭 ─────────────────────────────────────────────────────────────
  LANG_OTHER: "기타",

  // ── 감성 차트 ────────────────────────────────────────────────────────────
  CHART_LANG_FILTER: "언어 선택:",
  CHART_SHIFT_LEGEND: "급변 마커",
  CHART_VERY_POSITIVE: "매우 긍정적",
  CHART_MIXED: "복합적",
  CHART_NO_DATA: "차트 데이터가 없습니다.",

  // ── 타임라인 추가 ─────────────────────────────────────────────────────────
  TIMELINE_OFFICIAL_EVENTS: "공식 이벤트 {count}건",
  TIMELINE_EXTERNAL_EVENTS: "외부 이벤트 {count}건",
  TIMELINE_NO_EVENTS_LABEL: "이벤트 없음",
  TIMELINE_RELEASE_MARKER: "🚀 출시",
  TIMELINE_SHIFT_DETECTED: "⚡ 평가 급변 감지",
  TIMELINE_EMPTY: "수집된 이벤트가 없습니다.",

  // ── 평가 급변 카드 ────────────────────────────────────────────────────────
  SHIFT_CONFIDENCE_HIGH: "신뢰도 높음",
  SHIFT_CONFIDENCE_MEDIUM: "신뢰도 보통",
  SHIFT_CONFIDENCE_LOW: "데이터 부족",
  SHIFT_TYPE_DECLINE: "평가 급락 감지",
  SHIFT_TYPE_RISE: "평가 회복 감지",
  SHIFT_CONFIRMED: "공식확인",
  SHIFT_REFUTED: "게임외이슈 가능성",
  SHIFT_REVIEW_COUNT: "해당 구간 리뷰 {count}건 분석",
  SHIFT_AI_CAUSE_LABEL: "AI 추정 원인",
  SHIFT_LINKED_EVENTS_LABEL: "근방 공식 이벤트",
  SHIFT_LINKED_EVENTS_COUNT: "이벤트 {n}건",
  SHIFT_TOP_REVIEWS_LABEL: "이슈 관련 주요 리뷰",
  SHIFT_REVIEW_POSITIVE: "👍 긍정",
  SHIFT_REVIEW_NEGATIVE: "👎 부정",

  // ── 이벤트 등록 폼 추가 ──────────────────────────────────────────────────
  EVENT_AUTH_DESC: '"{title}" 이벤트를 등록하고 재분석을 시작합니다.',

  // ── 관리자 패널 추가 ──────────────────────────────────────────────────────
  ADMIN_GAMES_EMPTY: "등록된 게임이 없습니다.",
  ADMIN_COL_EVENTS: "수집 이벤트",
  ADMIN_REVIEWS_UNIT: " 리뷰",
  ADMIN_EVENTS_UNIT: " 건",
  ADMIN_COL_COLLECT_DATE: "수집 ",
  ADMIN_COL_ANALYZE_DATE: "분석 ",
  ADMIN_STEAM_REVIEWS: "Steam: {count}건",
  ADMIN_PROCESSING_BTN: "요청 중...",
  ADMIN_BTN_CORE_ANALYZE: "🔬 종합 분석",
  ADMIN_BTN_PW_PLACEHOLDER: "비밀번호",
  ADMIN_DRAG_HINT: "드래그해서 순서 변경",
  ADMIN_TOGGLE_ON_TITLE: "ON — 클릭하면 수집 중단(숨김)",
  ADMIN_TOGGLE_OFF_TITLE: "OFF — 클릭하면 수집 재개(활성)",
  ADMIN_APPROVE_CANCEL_TITLE: "클릭하면 AI 분석 승인이 취소됩니다.",
  ADMIN_APPROVE_TITLE: "클릭하면 AI 분석을 승인하고 즉시 분석 워크플로우가 트리거됩니다.",
  ADMIN_THIS_MONTH_TITLE: "이번 달 뉴스·이벤트를 재수집하고 AI 분석을 즉시 실행합니다.",
  ADMIN_CORE_ANALYZE_TITLE: "이벤트 수집 없이 AI 브리핑·CCU 피크타임·평가 추이·언어권 교차 분석만 즉시 갱신합니다.",
  ADMIN_REANALYZE_TITLE: "최신 뉴스·패치를 재수집하고 전체 기간 AI 분석을 다시 실행합니다.",
  ADMIN_TOAST_CORE_ANALYZE: "종합 분석을 요청했습니다. 수분 내 반영됩니다. (이벤트 수집 없이 브리핑·CCU·언어·추이만 갱신)",
  AUTH_WRONG_PASSWORD: "비밀번호가 올바르지 않습니다.",
  SERVER_CONNECT_ERROR: "서버 연결 오류",

  // ── COLUMN_HELP 텍스트 ────────────────────────────────────────────────────
  HELP_STATUS_TITLE: "수집 활성 ON / OFF",
  HELP_STATUS_L1: "ON (활성): 봇이 이 게임의 리뷰와 이벤트를 주기적으로 수집하며, 홈 화면에 노출됩니다.",
  HELP_STATUS_L2: "OFF (숨김): 수집이 중단되고 홈 화면에서 숨겨집니다. 기존 수집 데이터는 모두 보존되며, 언제든 다시 ON으로 복원할 수 있습니다.",
  HELP_STATUS_L3: "수집 중(파란색) 또는 수집 오류(빨간색) 상태에서는 ON/OFF 전환이 비활성화됩니다.",
  HELP_AI_TITLE: "AI 승인",
  HELP_AI_L1: "✅ 승인됨: 매월 1일 자동 AI 분석 대상에 포함됩니다. 관리자 패널의 '이번 달' 버튼 또는 '재분석' 버튼으로 온디맨드 실행도 가능합니다.",
  HELP_AI_L2: "⏳ 미승인: AI 분석이 실행되지 않습니다. 게임을 처음 등록하면 자동으로 미승인 상태가 됩니다.",
  HELP_AI_L3: "AI 분석 범위: 게임 브리핑, 이벤트별 패치 요약 및 플레이어 반응 분석, 언어권 교차 분석, CCU 피크타임 분석, 감성 추이 진단.",
  HELP_REVIEWS_TITLE: "수집 리뷰 / Steam 총 리뷰",
  HELP_REVIEWS_L1: "좌측 (수집): Google Sheets RAW 시트에 실제 저장된 리뷰 수입니다. collect.yml 워크플로우가 매일 누적합니다.",
  HELP_REVIEWS_L2: "우측 (Steam): Steam 스토어 기준 총 리뷰 수입니다. 수집 목표치로, 두 값이 같으면 모든 리뷰 수집이 완료된 상태입니다.",
  HELP_REVIEWS_L3: "수집 도중 커서가 리셋되면 좌측 값이 일시적으로 낮게 표시될 수 있습니다.",
  HELP_EVENTS_TITLE: "수집 이벤트",
  HELP_EVENTS_L1: "Google Sheets 타임라인 시트에 수집된 이벤트(공식 패치노트 + 외부 뉴스·미디어) 총 수입니다.",
  HELP_EVENTS_L2: "공식 이벤트: Steam 공식 발표 및 패치노트. 외부 이벤트: 관련 뉴스·미디어 기사.",
  HELP_EVENTS_L3: "현재 Steam 전체 공개 이벤트 수는 별도로 추적하지 않습니다.",
  HELP_DATES_TITLE: "마지막 수집 / AI 분석",
  HELP_DATES_L1: "마지막 수집: 이벤트가 마지막으로 수집·업데이트된 날짜입니다 (last_event_date 기준).",
  HELP_DATES_L2: "AI 분석: 게임 브리핑과 이벤트 AI 분석이 마지막으로 실행된 날짜입니다 (ai_briefing_date 기준).",
  HELP_DATES_L3: "두 날짜 차이가 클수록 수집 이후 AI 분석이 아직 반영되지 않은 구간이 있을 수 있습니다.",

  // ── AdminPanel 토스트 / 버튼 추가 ────────────────────────────────────────
  ADMIN_TOAST_APPROVE_ONLY: "AI 분석 승인 완료. 리뷰 수집 완료 후 다음 월간 분석 시 자동 실행됩니다.",
  ADMIN_TOAST_TIMELINE_ANALYZE: "타임라인 AI 분석을 시작했습니다. 완료까지 수 분~수십 분 소요됩니다.",
  ADMIN_TOAST_MONTH_REANALYZE: "{ym} 구간 재분석을 시작했습니다.",
  ADMIN_TOAST_EARLY_LAUNCH: "출시 초기 주간 분석을 시작했습니다. 수 분~수십 분 소요됩니다.",
  ADMIN_TOAST_COLLECT_NEWS: "이벤트/뉴스 수집을 시작했습니다. 수 분 내 완료됩니다.",
  ADMIN_TOAST_DETECT_SHIFTS: "평가 급변 감지를 시작했습니다. 수 분 내 완료됩니다.",
  ADMIN_MONTH_FORMAT_ERROR: "올바른 형식으로 입력해주세요 (예: 2024-03)",

  // ── AdminPanel 버튼 레이블 ────────────────────────────────────────────────
  ADMIN_BTN_CORE_ANALYZE_TITLE: "수집 없이 현재 데이터 기준으로 AI 현황 진단 · CCU 피크타임 · 평가 추이 종합 진단 · 언어권 교차 분석 4가지를 재실행합니다",
  ADMIN_BTN_TIMELINE_ANALYZE: "타임라인AI",
  ADMIN_BTN_TIMELINE_ANALYZE_TITLE: "수집 없이 현재 데이터로 전체 타임라인 월별 리뷰·이벤트를 재분석합니다. 완료 후 평가 급변 감지도 자동 실행됩니다.",
  ADMIN_BTN_MONTH_REANALYZE: "구간재분석",
  ADMIN_BTN_MONTH_REANALYZE_TITLE: "YYYY-MM 형식으로 년월을 입력해 해당 타임라인 구간만 선택 재분석합니다",
  ADMIN_BTN_EARLY_LAUNCH: "출시초기분석",
  ADMIN_BTN_EARLY_LAUNCH_TITLE: "출시 후 8주 내 주간 단위 세분화 분석을 실행합니다. 기존 월간 분석은 유지됩니다.",
  ADMIN_BTN_COLLECT_NEWS: "뉴스수집",
  ADMIN_BTN_COLLECT_NEWS_TITLE: "메타데이터·이벤트·뉴스를 최신화합니다. 이미 수집된 항목은 제외하고 신규 항목만 추가합니다. 리뷰 수집은 제외됩니다.",

  // ── 타임라인 주간 분석 ────────────────────────────────────────────────────
  TIMELINE_WEEKLY_BADGE: "주간",
  TIMELINE_WEEKLY_SECTION_LABEL: "📅 출시 초기 주간 세분화 분석",
  TIMELINE_HAS_WEEKLY: "주간분석",

  // ── 관리자 패널 — 게임 테이블 보조 레이블 ────────────────────────────────────
  ADMIN_COL_REVIEWS_TH: "리뷰",
  ADMIN_LABEL_COLLECTED: "수집",
  ADMIN_LABEL_STEAM_TOTAL: "Steam총계",
  ADMIN_BADGE_AUTO_REANALYZE: "↑ 자동 재분석 예정",
  ADMIN_BADGE_AUTO_REANALYZE_TITLE: "직전 분석 {last}건 → 현재 {cur}건 ({pct}% 증가) — 다음 분석 시 완료된 월도 자동 재분석됩니다",

  // ── 관리자 패널 — 컬럼 도움말 (리뷰) ─────────────────────────────────────────
  HELP_REVIEWS_L4: "↑ 자동 재분석 예정: 직전 분석 이후 리뷰가 10% 이상 증가했을 때 표시됩니다. 다음 월간 분석 시 완료된 월도 자동 재분석됩니다.",

  // ── 관리자 패널 — 버튼 색상 범례 ─────────────────────────────────────────────
  ADMIN_LEGEND_AI: "AI 분석",
  ADMIN_LEGEND_COLLECT: "수집",
  ADMIN_LEGEND_DETECT: "감지·주의",
  ADMIN_LEGEND_MAINTAIN: "유지보수",

  // ── 관리자 패널 — 시스템 도구 카드 ──────────────────────────────────────────
  ADMIN_TOOL_PENDING_TITLE: "미분석 AI 분석",
  ADMIN_TOOL_PENDING_DESC: "아직 AI 분석이 진행되지 않은 구간을 자동 선별해 현재 데이터 기준으로 분석합니다. 월별 타임라인, CCU 피크타임, 종합 분석, 언어 분포 등 모든 AI 분석 항목을 대상으로 합니다.",
  ADMIN_BTN_ANALYZE_PENDING_EXEC: "⚡ 미분석 분석 실행",
  ADMIN_TOOL_SHIFTS_TITLE: "평가 급변 감지",
  ADMIN_TOOL_SHIFTS_DESC: "전체 active 게임의 긍정률 급변 구간을 탐지하고, 이상 감지 시 AI 원인 분석을 실행합니다. 이미 감지된 구간은 건너뛰고 신규 구간에 대해서만 진행합니다. 매주 월요일 자동 실행됩니다.",
  ADMIN_BTN_DETECT_SHIFTS_EXEC: "🔍 급변 감지 실행",
  ADMIN_TOOL_RETRIGGER_TITLE: "수집 재시작",
  ADMIN_TOOL_RETRIGGER_DESC: "일일 봇 스케줄과 무관하게 전체 게임 리뷰·이벤트·뉴스 수집을 즉시 트리거합니다.",
  ADMIN_BTN_RETRIGGER_EXEC: "🔄 수집 재시작",
  ADMIN_TOOL_RECALC_TITLE: "언어 분포 재집계",
  ADMIN_TOOL_RECALC_DESC: "전체 게임 RAW 리뷰 기반 언어 분포 JSON을 강제 재계산합니다. 파이 차트 데이터·상위 언어 목록·수집 건수 보정이 함께 갱신됩니다.",
  ADMIN_BTN_RECALC_EXEC: "📊 재집계 실행",
  ADMIN_TOOL_DEDUP_TITLE: "타임라인 중복 정리",
  ADMIN_TOOL_DEDUP_DESC: "전체 게임 타임라인에서 중복 이벤트를 일괄 검사하고 제거합니다. 뒤에서부터 역순으로 삭제해 인덱스 오염을 방지합니다.",
  ADMIN_BTN_DEDUP_EXEC: "🧹 중복 정리 실행",
  ADMIN_TOAST_RECALC_LANG: "언어 분포 재집계를 시작했습니다. 수 분 내 완료됩니다.",
  ADMIN_TOAST_DEDUP_TIMELINES: "타임라인 중복 정리를 시작했습니다. 수 분 내 완료됩니다.",

  // ── 관리자 패널 — 워크플로우 현황 테이블 ─────────────────────────────────────
  ADMIN_SECTION_WORKFLOW: "GitHub Actions 워크플로우 현황",
  TH_WORKFLOW_SCHEDULE: "실행 주기",
  ADMIN_WF_CCU_NAME: "CCU 수집",
  ADMIN_WF_CCU_SCHEDULE: "매 시간 정각",
  ADMIN_WF_CCU_DESC: "active 게임의 동접자를 Steam API로 수집해 개별 시트에 적재합니다.",
  ADMIN_WF_COLLECT_NAME: "리뷰·뉴스 수집",
  ADMIN_WF_COLLECT_SCHEDULE: "매일 05:00 KST",
  ADMIN_WF_COLLECT_DESC: "신규 리뷰·이벤트를 수집합니다. active 게임은 기존 수집 리뷰 ID를 미리 로드해 이미 수집한 페이지에 도달하면 즉시 조기 종료합니다. 게임 신규 등록 시 자동 트리거됩니다.",
  ADMIN_WF_ANALYZE_NAME: "AI 월간 분석",
  ADMIN_WF_ANALYZE_SCHEDULE: "매월 1일 09:00 KST",
  ADMIN_WF_ANALYZE_DESC: "AI 승인된 게임의 월별 감성 분석·패치 요약·AI 브리핑·CCU·언어권 교차 분석을 실행합니다. 직전 분석 이후 리뷰가 10% 이상 증가한 경우 완료된 월도 자동 재분석합니다.",
  ADMIN_WF_SHIFTS_NAME: "평가 급변 감지",
  ADMIN_WF_SHIFTS_SCHEDULE: "매주 월 11:00 KST",
  ADMIN_WF_SHIFTS_DESC: "전체 기간 긍정률 변화를 분석해 급락·회복 구간을 탐지하고 AI 원인 분석을 수행합니다. 이미 감지된 구간은 재분석하지 않습니다.",
  ADMIN_WF_CORE_NAME: "대표AI 분석",
  ADMIN_WF_CORE_SCHEDULE: "수동 (게임별)",
  ADMIN_WF_CORE_DESC: "수집 없이 현재 데이터로 AI 현황 진단·CCU 피크타임·평가 추이·언어권 교차 분석 4가지를 즉시 재실행합니다. 게임별 [대표AI] 버튼으로 트리거.",
  ADMIN_WF_TIMELINE_NAME: "타임라인AI 분석",
  ADMIN_WF_TIMELINE_SCHEDULE: "수동 (게임별)",
  ADMIN_WF_TIMELINE_DESC: "수집 없이 현재 데이터로 전체 타임라인 월별 재분석 후 평가 급변 감지를 실행합니다. 게임별 [타임라인AI] 버튼으로 트리거.",
  ADMIN_WF_MONTH_NAME: "구간 재분석",
  ADMIN_WF_MONTH_SCHEDULE: "수동 (게임별)",
  ADMIN_WF_MONTH_DESC: "YYYY-MM 입력으로 특정 월의 타임라인 구간만 선택 재분석합니다. 해당 게임에 없는 년월 입력 시 분석을 건너뜁니다. 게임별 [구간재분석] 버튼으로 트리거.",
  ADMIN_WF_NEWS_NAME: "이벤트/뉴스 수집",
  ADMIN_WF_NEWS_SCHEDULE: "수동 (게임별)",
  ADMIN_WF_NEWS_DESC: "메타데이터·이벤트·뉴스를 최신화합니다. 이미 수집된 항목은 제외하고 신규 항목만 추가합니다. 리뷰 수집은 제외됩니다. 게임별 [뉴스수집] 버튼으로 트리거.",
  ADMIN_WF_PENDING_NAME: "미분석 AI 분석",
  ADMIN_WF_PENDING_SCHEDULE: "수동 (시스템)",
  ADMIN_WF_PENDING_DESC: "AI 분석이 진행되지 않은 구간을 전 게임 대상으로 선별해 일괄 분석합니다. 시스템 도구 [미분석 분석 실행] 버튼으로 트리거.",
  ADMIN_WF_RETRIGGER_NAME: "수집 재시작",
  ADMIN_WF_RETRIGGER_SCHEDULE: "수동 (시스템)",
  ADMIN_WF_RETRIGGER_DESC: "일일 봇 스케줄과 무관하게 전체 게임 리뷰·이벤트·뉴스 수집을 즉시 트리거합니다. 시스템 도구 [수집 재시작] 버튼으로 트리거.",
  ADMIN_WF_RECALC_NAME: "언어 분포 재집계",
  ADMIN_WF_RECALC_SCHEDULE: "수동 (시스템)",
  ADMIN_WF_RECALC_DESC: "전체 게임 RAW 리뷰 언어 분포를 재계산해 language_distribution·top_languages·수집 건수를 갱신합니다. 시스템 도구 [재집계 실행] 버튼으로 트리거.",
  ADMIN_WF_DEDUP_NAME: "타임라인 중복 정리",
  ADMIN_WF_DEDUP_SCHEDULE: "수동 (시스템)",
  ADMIN_WF_DEDUP_DESC: "전체 게임 타임라인 탭에서 중복 이벤트를 일괄 검사·제거합니다. 시스템 도구 [중복 정리 실행] 버튼으로 트리거.",

  // ── 관리자 패널 — 모달 ───────────────────────────────────────────────────────
  ADMIN_MODAL_MONTH_INPUT_TITLE: "구간 재분석",
  ADMIN_MODAL_MONTH_INPUT_DESC: "재분석할 년월을 입력하세요. 해당 게임의 타임라인에 없는 년월이면 분석을 건너뜁니다.",
  ADMIN_MODAL_MONTH_PLACEHOLDER: "예: 2024-03",
  ADMIN_BTN_REANALYZE_EXEC: "재분석 시작",
  ADMIN_RETRIGGER_CONFIRM_DESC: "전체 active 게임의 리뷰·이벤트·뉴스 수집을 즉시 시작합니다. 일일 자동 수집과 병렬 실행될 수 있습니다. 계속하시겠습니까?",
  ADMIN_MODAL_INCOMPLETE_REVIEWS_TITLE: "⚠️ 리뷰 수집 미완료",
  ADMIN_MODAL_INCOMPLETE_REVIEWS_DESC: "{name}의 리뷰가 아직 모두 수집되지 않았습니다.",
  ADMIN_MODAL_INCOMPLETE_REVIEWS_COUNTS: "{collected}건 수집 / Steam 총 {total}건",
  ADMIN_MODAL_INCOMPLETE_REVIEWS_WARN: "이 상태에서 AI 분석을 실행하면 일부 기간이 불완전한 데이터로 분석됩니다.",
  ADMIN_BTN_APPROVE_NOW: "🚀 지금 기준으로 AI 분석 시작",
  ADMIN_BTN_APPROVE_WAIT: "⏳ 리뷰 수집 완료 후 분석하기 (승인만)",

  // ── 관리자 패널 — 리포트 관리 섹션 ───────────────────────────────────────────
  ADMIN_SECTION_REPORTS: "리포트 관리",
  ADMIN_REPORTS_SUBTITLE: "홈 화면에 표시할 리포트를 관리합니다. 숨김 처리된 리포트는 데이터가 보존됩니다.",
  ADMIN_REPORTS_VISIBLE_LABEL: "공개",
  ADMIN_REPORTS_HIDDEN_LABEL: "숨김",
  ADMIN_REPORTS_BTN_HIDE: "숨기기",
  ADMIN_REPORTS_BTN_SHOW: "복원",
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
