"""
MASTER_SPREADSHEET 최초 생성 스크립트
python backend/sheets/setup_sheets.py 로 1회 실행
"""
import gspread
from google.oauth2.service_account import Credentials
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import get_google_creds, MASTER_SPREADSHEET_ID
from sheets.master_sheet import (
    GAMES_HEADERS, TIMELINE_HEADERS, CCU_HEADERS, SCOPES
)

def setup():
    creds = Credentials.from_service_account_info(get_google_creds(), scopes=SCOPES)
    client = gspread.authorize(creds)

    if MASTER_SPREADSHEET_ID:
        ss = client.open_by_key(MASTER_SPREADSHEET_ID)
        print(f"기존 스프레드시트 사용: {ss.title}")
    else:
        ss = client.create("MASTER_SPREADSHEET — 스팀 탈곡기 Pro")
        print(f"새 스프레드시트 생성: {ss.id}")
        print("⚠️  위 ID를 .env의 MASTER_SPREADSHEET_ID에 저장하세요")

    existing = [ws.title for ws in ss.worksheets()]

    # config 탭
    if "config" not in existing:
        ws = ss.add_worksheet(title="config", rows=50, cols=3)
    else:
        ws = ss.worksheet("config")
    ws.clear()
    ws.append_row(["key", "value", "description"])
    config_defaults = [
        ["admin_password", "changeme123", "관리자 비밀번호"],
        ["ui_text.header_logo", "스팀 탈곡기 Pro", "네비게이션 로고 텍스트"],
        ["ui_text.home_title", "Steam 게임 마켓 인텔리전스", "홈 화면 제목"],
        ["ui_text.search_placeholder", "게임명 또는 AppID 입력", "검색창 플레이스홀더"],
        ["ui_text.register_button", "이 게임 분석 등록하기", "등록 버튼 텍스트"],
        ["ui_text.guide_link", "분석 방법 가이드", "상단 메뉴 가이드 링크"],
    ]
    ws.append_rows(config_defaults)
    print("[OK] config 탭 완료")

    # games 탭
    if "games" not in existing:
        ws = ss.add_worksheet(title="games", rows=200, cols=len(GAMES_HEADERS))
    else:
        ws = ss.worksheet("games")
        ws.clear()
    ws.append_row(GAMES_HEADERS)
    print("[OK] games 탭 완료")

    # 기본 Sheet1 제거
    try:
        ss.del_worksheet(ss.worksheet("Sheet1"))
    except Exception:
        pass

    print(f"\n[완료] 스프레드시트 ID: {ss.id}")
    print(f"URL: https://docs.google.com/spreadsheets/d/{ss.id}")
    return ss.id

if __name__ == "__main__":
    setup()
