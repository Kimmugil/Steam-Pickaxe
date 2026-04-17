"""
setup_ui_text.py — Google Sheets의 ui_text 탭 초기값 세팅

실행 방법:
  cd backend
  python -m sheets.setup_ui_text

동작:
  1. MASTER_SPREADSHEET_ID의 스프레드시트에 'ui_text' 탭이 없으면 생성
  2. 헤더 행 (key | value | description) 추가
  3. 기본 텍스트 값을 일괄 삽입 (이미 존재하는 행은 덮어쓰지 않음)

관리 방법:
  - 이후 텍스트 수정은 Google Sheets에서 직접 셀 값을 바꾸기만 하면 됩니다.
  - 변경 후 60초 이내에 Next.js 캐시가 갱신되어 웹 UI에 반영됩니다.
  - 새 키 추가 시 이 스크립트에도 DEFAULT_TEXT에 추가해 두면 동기화가 편합니다.

플레이스홀더 치환 규칙:
  - {name}, {hours}, {mins} 등 중괄호로 감싼 변수명을 사용합니다.
  - 예) REGISTER_SUCCESS = "{name} 등록 완료! 수집이 시작됩니다."
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import get_google_creds

import gspread
from google.oauth2.service_account import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

# ── 기본 UI 텍스트 정의 ──────────────────────────────────────────────────────
# (key, value, description) 순서
DEFAULT_TEXT: list[tuple[str, str, str]] = [
    # 홈 페이지
    ("HOME_TITLE",              "Steam 게임 마켓 인텔리전스",                                "홈 페이지 메인 타이틀"),
    ("HOME_SUBTITLE",           "업데이트 민심 · 트래픽 · 언어권 반응을 한눈에 꿰뚫는 스팀 분석 대시보드", "홈 페이지 서브타이틀"),

    # 검색창
    ("SEARCH_PLACEHOLDER",      "게임명, AppID, 또는 스팀 상점 URL 입력",                   "검색창 placeholder"),
    ("SEARCH_HINT",             "스팀 특성상 한글 검색 시 결과가 부정확할 수 있습니다. 영문 검색을 권장합니다.", "검색창 하단 안내 문구"),
    ("SEARCH_BTN",              "검색",                                                     "검색 버튼 텍스트"),
    ("SEARCH_BTN_LOADING",      "검색 중...",                                               "검색 버튼 로딩 텍스트"),
    ("SEARCH_NOT_FOUND",        "검색 결과를 찾을 수 없습니다.",                            "검색 결과 없음 메시지"),
    ("SEARCH_ALREADY_REGISTERED", "이미 등록된 게임입니다. 상세 페이지로 이동합니다.",      "이미 등록된 게임 알림"),
    ("SEARCH_NOT_GAME",         "게임 타입의 앱만 등록 가능합니다.",                        "게임 타입 아닌 경우 알림"),

    # 등록
    ("REGISTER_BTN",            "이 게임 분석 등록하기",                                    "등록 버튼 텍스트"),
    ("REGISTER_BTN_LOADING",    "등록 중...",                                               "등록 버튼 로딩 텍스트"),
    ("REGISTER_SUCCESS",        "{name} 등록 완료! 수집이 시작됩니다.",                     "등록 성공 메시지 ({name} = 게임명)"),
    ("REGISTER_ERROR",          "등록 중 오류가 발생했습니다.",                             "등록 실패 메시지"),
    ("REGISTER_QUOTA_EXCEEDED", "곳간 용량 부족! 농장주(김무길)에게 곳간을 늘려달라고 하세요.", "Drive 할당량 초과 메시지"),

    # 검색 결과 메타 레이블
    ("RESULT_LABEL_APPID",      "AppID",                                                    "결과 카드 AppID 레이블"),
    ("RESULT_LABEL_RELEASE",    "출시일",                                                   "결과 카드 출시일 레이블"),
    ("RESULT_LABEL_DEVELOPER",  "개발사",                                                   "결과 카드 개발사 레이블"),
    ("RESULT_LABEL_PUBLISHER",  "배급사",                                                   "결과 카드 배급사 레이블"),
    ("RESULT_LABEL_REVIEWS",    "리뷰",                                                     "결과 카드 리뷰 수 레이블"),
    ("RESULT_LABEL_POSITIVE_RATE", "긍정률",                                               "결과 카드 긍정률 레이블"),

    # 수집 대기열
    ("QUEUE_SECTION_TITLE",     "데이터 수집 대기열",                                       "수집 대기열 섹션 제목"),
    ("QUEUE_COLLECTING",        "수집 중...",                                               "수집 중 뱃지 텍스트"),
    ("QUEUE_CANCEL_BTN",        "등록 취소",                                                "등록 취소 버튼"),
    ("QUEUE_CANCEL_CONFIRM_BTN","등록 취소 확인",                                           "모달 취소 확인 버튼"),
    ("QUEUE_CANCEL_SUCCESS",    "등록이 취소되었습니다.",                                   "취소 성공 메시지"),
    ("QUEUE_ETA_SOON",          "잠시 후 완료",                                             "잔여 시간 거의 없을 때"),
    ("QUEUE_ETA_HOURS",         "약 {hours}시간",                                           "잔여 시간 (시간 단위, {hours} = 숫자)"),
    ("QUEUE_ETA_MINS",          "약 {mins}분",                                              "잔여 시간 (분 단위, {mins} = 숫자)"),
    ("QUEUE_ETA_LABEL",         "예상 잔여 시간",                                           "ETA 레이블"),
    ("QUEUE_ETA_SUFFIX",        "(Steam API 상태에 따라 변동)",                             "ETA 부가 설명"),

    # 게임 목록
    ("GAMES_SECTION_TITLE",     "분석 완료된 게임",                                         "활성 게임 섹션 제목"),
    ("GAMES_EMPTY_ICON",        "🎮",                                                       "게임 없을 때 아이콘"),
    ("GAMES_EMPTY_TITLE",       "아직 등록된 게임이 없습니다.",                             "게임 없을 때 타이틀"),
    ("GAMES_EMPTY_SUBTITLE",    "위 검색창에서 Steam 게임을 검색하고 등록해 보세요.",       "게임 없을 때 서브타이틀"),

    # 관리자 모달
    ("ADMIN_PW_TITLE",          "관리자 비밀번호 확인",                                     "관리자 모달 제목"),
    ("ADMIN_PW_PLACEHOLDER",    "비밀번호 입력",                                            "비밀번호 입력 placeholder"),
    ("ADMIN_CLOSE_BTN",         "닫기",                                                     "모달 닫기 버튼"),
    ("ADMIN_GENERIC_ERROR",     "오류가 발생했습니다.",                                     "일반 오류 메시지"),

    # 내비게이션
    ("NAV_BRAND",               "⚡ 스팀 탈곡기 Pro",                                       "사이트 브랜드명 (Navbar 좌측)"),
    ("NAV_GUIDE",               "분석 방법 가이드",                                         "가이드 페이지 링크 텍스트"),
]

HEADERS = ["key", "value", "description"]


def setup_ui_text_tab():
    creds = Credentials.from_service_account_info(get_google_creds(), scopes=SCOPES)
    client = gspread.authorize(creds)

    spreadsheet_id = os.environ.get("MASTER_SPREADSHEET_ID")
    if not spreadsheet_id:
        raise RuntimeError("환경변수 MASTER_SPREADSHEET_ID가 설정되지 않았습니다.")

    ss = client.open_by_key(spreadsheet_id)

    # 탭 존재 확인
    try:
        ws = ss.worksheet("ui_text")
        print("✅ ui_text 탭이 이미 존재합니다.")
    except gspread.WorksheetNotFound:
        ws = ss.add_worksheet(title="ui_text", rows=200, cols=3)
        print("🆕 ui_text 탭을 새로 생성했습니다.")

    # 현재 데이터 조회
    existing_data = ws.get_all_values()

    if not existing_data or existing_data[0] != HEADERS:
        # 헤더가 없거나 다르면 전체 초기화
        ws.clear()
        all_rows = [HEADERS] + [[k, v, d] for k, v, d in DEFAULT_TEXT]
        ws.update(all_rows, "A1")
        print(f"✅ 헤더 + {len(DEFAULT_TEXT)}개 기본값 삽입 완료.")
        return

    # 헤더가 있으면 기존 키 확인 후 신규 키만 추가
    existing_keys = {row[0] for row in existing_data[1:] if row}
    new_rows = [
        [k, v, d]
        for k, v, d in DEFAULT_TEXT
        if k not in existing_keys
    ]
    if new_rows:
        ws.append_rows(new_rows)
        print(f"➕ 신규 키 {len(new_rows)}개 추가: {[r[0] for r in new_rows]}")
    else:
        print("ℹ️  추가할 신규 키 없음. 모든 키가 이미 존재합니다.")
    print("완료! Google Sheets에서 value 열을 수정하면 60초 내 웹 UI에 반영됩니다.")


if __name__ == "__main__":
    setup_ui_text_tab()
