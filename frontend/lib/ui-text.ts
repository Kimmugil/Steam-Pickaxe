/**
 * UI_TEXT — 프론트엔드 UI 텍스트 중앙 관리
 * 모든 정적 텍스트(메뉴, 버튼, 안내문, 알림)는 이 파일에서 관리합니다.
 */

export const UI_TEXT = {
  // ── 홈 페이지 ─────────────────────────────────────────
  HOME_TITLE: "Steam 게임 마켓 인텔리전스",
  HOME_SUBTITLE: "업데이트 민심 · 트래픽 · 언어권 반응을 한눈에 꿰뚫는 스팀 분석 대시보드",

  // ── 검색창 ───────────────────────────────────────────
  SEARCH_PLACEHOLDER: "게임명, AppID, 또는 스팀 상점 URL 입력",
  SEARCH_HINT: "스팀 특성상 한글 검색 시 결과가 부정확할 수 있습니다. 영문 검색을 권장합니다.",
  SEARCH_BTN: "검색",
  SEARCH_BTN_LOADING: "검색 중...",
  SEARCH_NOT_FOUND: "검색 결과를 찾을 수 없습니다.",
  SEARCH_ALREADY_REGISTERED: "이미 등록된 게임입니다. 상세 페이지로 이동합니다.",
  SEARCH_NOT_GAME: "게임 타입의 앱만 등록 가능합니다.",

  // ── 등록 ─────────────────────────────────────────────
  REGISTER_BTN: "이 게임 분석 등록하기",
  REGISTER_BTN_LOADING: "등록 중...",
  REGISTER_SUCCESS: (name: string) => `${name} 등록 완료! 수집이 시작됩니다.`,
  REGISTER_ERROR: "등록 중 오류가 발생했습니다.",
  REGISTER_QUOTA_EXCEEDED:
    "곳간 용량 부족! 농장주(김무길)에게 곳간을 늘려달라고 하세요.",

  // ── 검색 결과 카드 ────────────────────────────────────
  RESULT_LABEL_APPID: "AppID",
  RESULT_LABEL_RELEASE: "출시일",
  RESULT_LABEL_DEVELOPER: "개발사",
  RESULT_LABEL_PUBLISHER: "배급사",
  RESULT_LABEL_REVIEWS: "리뷰",
  RESULT_LABEL_POSITIVE_RATE: "긍정률",

  // ── 수집 대기열 ───────────────────────────────────────
  QUEUE_SECTION_TITLE: "데이터 수집 대기열",
  QUEUE_COLLECTING: "수집 중...",
  QUEUE_CANCEL_BTN: "등록 취소",
  QUEUE_CANCEL_CONFIRM_BTN: "등록 취소 확인",
  QUEUE_CANCEL_SUCCESS: "등록이 취소되었습니다.",
  QUEUE_ETA_SOON: "잠시 후 완료",
  QUEUE_ETA_HOURS: (h: number) => `약 ${h}시간`,
  QUEUE_ETA_MINS: (m: number) => `약 ${m}분`,
  QUEUE_ETA_LABEL: "예상 잔여 시간",
  QUEUE_ETA_SUFFIX: "(Steam API 상태에 따라 변동)",

  // ── 분석 완료 게임 목록 ────────────────────────────────
  GAMES_SECTION_TITLE: "분석 완료된 게임",
  GAMES_EMPTY_ICON: "🎮",
  GAMES_EMPTY_TITLE: "아직 등록된 게임이 없습니다.",
  GAMES_EMPTY_SUBTITLE: "위 검색창에서 Steam 게임을 검색하고 등록해 보세요.",

  // ── 관리자 모달 ───────────────────────────────────────
  ADMIN_PW_TITLE: "관리자 비밀번호 확인",
  ADMIN_PW_PLACEHOLDER: "비밀번호 입력",
  ADMIN_CLOSE_BTN: "닫기",
  ADMIN_GENERIC_ERROR: "오류가 발생했습니다.",

  // ── 내비게이션 ────────────────────────────────────────
  NAV_HOME: "스팀 탈곡기 Pro",
  NAV_GUIDE: "분석 가이드",
} as const;
