import { NextRequest, NextResponse } from "next/server";
import { getConfig, syncUiText } from "@/lib/sheets";

/**
 * POST /api/admin/sync-ui-text
 * ui_text 탭에 누락된 기본 키를 일괄 추가합니다.
 * 이미 값이 있는 키는 보존됩니다 (관리자 커스텀 값 유지).
 *
 * Body: { password: string }
 */

// UiTextContext의 FALLBACK과 동일한 키-값 세트
// (클라이언트 전용 컨텍스트를 서버 라우트에서 import할 수 없어 별도 유지)
const FALLBACK: Record<string, string> = {
  NAV_BRAND: "⚡ 스팀 탈곡기 Pro",
  NAV_GUIDE: "분석 방법 가이드",
  HOME_TITLE: "Steam 게임 마켓 인텔리전스",
  HOME_SUBTITLE: "업데이트 민심 · 트래픽 · 언어권 반응을 한눈에 꿰뚫는 스팀 분석 대시보드",
  SEARCH_PLACEHOLDER: "게임명, AppID, 또는 스팀 상점 URL 입력",
  SEARCH_HINT: "스팀 특성상 한글 검색 시 결과가 부정확할 수 있습니다. 영문 검색을 권장합니다.",
  SEARCH_BTN: "검색",
  SEARCH_BTN_LOADING: "검색 중...",
  SEARCH_NOT_FOUND: "검색 결과를 찾을 수 없습니다.",
  SEARCH_ALREADY_REGISTERED: "이미 등록된 게임입니다. 상세 페이지로 이동합니다.",
  SEARCH_NOT_GAME: "게임 타입의 앱만 등록 가능합니다.",
  REGISTER_BTN: "이 게임 분석 등록하기",
  REGISTER_BTN_LOADING: "등록 중...",
  REGISTER_SUCCESS: "{name} 등록 완료! 수집이 시작됩니다.",
  REGISTER_ERROR: "등록 중 오류가 발생했습니다.",
  REGISTER_QUOTA_EXCEEDED: "곳간 용량 부족! 농장주(김무길)에게 곳간을 늘려달라고 하세요.",
  RESULT_LABEL_APPID: "AppID",
  RESULT_LABEL_RELEASE: "출시일",
  RESULT_LABEL_DEVELOPER: "개발사",
  RESULT_LABEL_PUBLISHER: "배급사",
  RESULT_LABEL_REVIEWS: "리뷰",
  RESULT_LABEL_POSITIVE_RATE: "긍정률",
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
  GAMES_SECTION_TITLE: "분석 완료된 게임",
  GAMES_EMPTY_ICON: "🎮",
  GAMES_EMPTY_TITLE: "아직 등록된 게임이 없습니다.",
  GAMES_EMPTY_SUBTITLE: "위 검색창에서 Steam 게임을 검색하고 등록해 보세요.",
  CARD_REVIEWS_LABEL: "리뷰 {n}건",
  CARD_EVENTS_LABEL: "이벤트 {n}건",
  CARD_DAYS_AGO: "{n}일 전 업데이트",
  CARD_LAST_EVENT_LABEL: "최근 이벤트",
  CARD_AI_DATE_LABEL: "AI 분석",
  ADMIN_PW_TITLE: "관리자 비밀번호 확인",
  ADMIN_PW_PLACEHOLDER: "비밀번호 입력",
  ADMIN_CLOSE_BTN: "닫기",
  ADMIN_GENERIC_ERROR: "오류가 발생했습니다.",
  POOL_EMPTY_MSG: "곳간 용량 부족! 농장주(김무길)에게 곳간을 늘려달라고 하세요.",
  POOL_EMPTY_RETRY_BTN: "곳간 보충 후 재시도",
  POOL_EMPTY_RETRY_SUCCESS: "재시도 요청 완료. 다음 수집 실행 시 자동으로 처리됩니다.",
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
  TAB_CCU: "글로벌 트래픽 (CCU)",
  TAB_SENTIMENT: "평가 추이",
  TAB_LANGUAGE: "언어권별 분포",
  HISTORY_TITLE: "업데이트 히스토리",
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
  EVENT_FORM_TOGGLE: "수동 이슈/이벤트 등록 (관리자)",
  EVENT_TITLE_PLACEHOLDER: "이벤트 제목 (예: 서버 장애, 대규모 업데이트)",
  EVENT_URL_PLACEHOLDER: "이벤트 URL (선택, 패치노트/공지 링크)",
  EVENT_CONTENT_PLACEHOLDER: "패치노트 전문, 공지사항, 커뮤니티 포스트 내용을 직접 붙여넣으세요.\nAI가 이 텍스트를 바탕으로 타임라인 카드를 생성합니다.\n(URL만으로 크롤링이 어려울 때 활용)",
  EVENT_SUBMIT_BTN: "이벤트 등록 + 재분석",
  EVENT_SUBMIT_BTN_LOADING: "등록 중...",
  EVENT_AUTH_TITLE: "이벤트 등록 인증",
  EVENT_SUCCESS: "이벤트가 등록되었습니다. 재분석이 시작됩니다.",
  REANALYZE_TITLE: "AI 분석 새로고침",
  REANALYZE_DESC: "최신 뉴스·패치 재수집 후 AI 분석을 다시 실행합니다. 완료까지 수분~수십 분 소요될 수 있습니다.",
  REANALYZE_BTN: "분석 새로고침",
  REANALYZE_BTN_LOADING: "요청 중...",
  REANALYZE_SUCCESS: "분석 새로고침이 요청됐습니다. 수분 내 반영됩니다.",
  REANALYZE_AUTH_DESC: "최신 뉴스·패치를 재수집하고 AI 분석을 다시 실행합니다.",
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

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (!password) {
      return NextResponse.json({ error: "비밀번호가 필요합니다." }, { status: 400 });
    }

    const config = await getConfig();
    if (password !== config.admin_password) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const result = await syncUiText(FALLBACK);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
