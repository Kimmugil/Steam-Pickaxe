"""
개별 게임 시트 읽기/쓰기 전담 모듈
각 게임마다 생성된 RAW 스프레드시트의 timeline 탭 관리
master_sheet.py 의 timeline_{appid} 탭 대신 이 모듈을 사용한다.
"""
import gspread
from google.oauth2.service_account import Credentials
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import get_google_creds

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

TIMELINE_HEADERS = [
    "event_id", "event_type", "date", "title", "language_scope",
    "sentiment_rate", "review_count", "ai_patch_summary",
    "ai_reaction_summary", "top_keywords", "top_reviews", "url",
    "is_sale_period", "sale_text", "is_free_weekend",
]


def _get_client() -> gspread.Client:
    creds = Credentials.from_service_account_info(get_google_creds(), scopes=SCOPES)
    return gspread.authorize(creds)


def open_game_sheet(game_sheet_id: str) -> gspread.Spreadsheet:
    """game_sheet_id(개별 스프레드시트 ID)로 시트 열기"""
    return _get_client().open_by_key(game_sheet_id)


# ──────────────────────────────────────────────
# timeline 탭 (개별 게임 시트)
# ──────────────────────────────────────────────

def get_or_create_timeline_tab(ss: gspread.Spreadsheet) -> gspread.Worksheet:
    try:
        return ss.worksheet("timeline")
    except gspread.WorksheetNotFound:
        ws = ss.add_worksheet(title="timeline", rows=2000, cols=len(TIMELINE_HEADERS))
        ws.append_row(TIMELINE_HEADERS)
        return ws


def get_timeline(ss: gspread.Spreadsheet) -> list[dict]:
    ws = get_or_create_timeline_tab(ss)
    return ws.get_all_records()


def append_timeline_row(ss: gspread.Spreadsheet, row: dict):
    ws = get_or_create_timeline_tab(ss)
    ws.append_row([row.get(h, "") for h in TIMELINE_HEADERS])


def update_timeline_row(
    ss: gspread.Spreadsheet,
    event_id: str,
    language_scope: str,
    updates: dict,
):
    ws = get_or_create_timeline_tab(ss)
    records = ws.get_all_records()
    headers = ws.row_values(1)
    for i, rec in enumerate(records):
        if (
            str(rec.get("event_id")) == str(event_id)
            and str(rec.get("language_scope")) == language_scope
        ):
            row_idx = i + 2
            for key, val in updates.items():
                if key in headers:
                    col_idx = headers.index(key) + 1
                    ws.update_cell(row_idx, col_idx, val)
            return


def delete_timeline_rows_by_event(ss: gspread.Spreadsheet, event_id: str):
    ws = get_or_create_timeline_tab(ss)
    records = ws.get_all_records()
    rows_to_delete = [
        i + 2
        for i, r in enumerate(records)
        if str(r.get("event_id")) == str(event_id)
    ]
    for row_idx in sorted(rows_to_delete, reverse=True):
        ws.delete_rows(row_idx)
