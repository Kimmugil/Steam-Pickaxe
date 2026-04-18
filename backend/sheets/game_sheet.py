"""
개별 게임 시트 읽기/쓰기 전담 모듈
각 게임마다 생성된 RAW 스프레드시트의 timeline / ccu 탭 관리
master_sheet.py 의 timeline_{appid}, ccu_{appid} 탭 대신 이 모듈을 사용한다.
마스터 시트는 config / games / ui_text 탭만 유지한다.
"""
import gspread
from google.oauth2.service_account import Credentials
import sys, os, time, functools
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import get_google_creds


def _retry_on_quota(fn):
    """Exponential backoff retry decorator for Google Sheets 429 rate limit errors."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        waits = [5, 10, 20, 40, 60]
        for attempt, wait in enumerate(waits):
            try:
                return fn(*args, **kwargs)
            except gspread.exceptions.APIError as e:
                if "429" in str(e):
                    print(f"[rate_limit] 429 — {wait}초 대기 후 재시도 ({attempt+1}/5)")
                    time.sleep(wait)
                else:
                    raise
        # Final attempt after all waits exhausted
        return fn(*args, **kwargs)
    return wrapper

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


@_retry_on_quota
def get_timeline(ss: gspread.Spreadsheet) -> list[dict]:
    ws = get_or_create_timeline_tab(ss)
    return ws.get_all_records()


@_retry_on_quota
def append_timeline_row(ss: gspread.Spreadsheet, row: dict):
    ws = get_or_create_timeline_tab(ss)
    ws.append_row([row.get(h, "") for h in TIMELINE_HEADERS])


@_retry_on_quota
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


@_retry_on_quota
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


# ──────────────────────────────────────────────
# ccu 탭 (개별 게임 시트)
# ──────────────────────────────────────────────

CCU_HEADERS = ["timestamp", "ccu_value", "is_sale_period", "is_free_weekend", "is_archived_gap"]


def get_or_create_ccu_tab(ss: gspread.Spreadsheet) -> gspread.Worksheet:
    try:
        return ss.worksheet("ccu")
    except gspread.WorksheetNotFound:
        ws = ss.add_worksheet(title="ccu", rows=50000, cols=len(CCU_HEADERS))
        ws.append_row(CCU_HEADERS)
        return ws


@_retry_on_quota
def get_ccu_data(ss: gspread.Spreadsheet) -> list[dict]:
    ws = get_or_create_ccu_tab(ss)
    return ws.get_all_records()


@_retry_on_quota
def append_ccu(
    ss: gspread.Spreadsheet,
    timestamp: str,
    ccu_value: int,
    is_sale: bool = False,
    is_free_weekend: bool = False,
):
    ws = get_or_create_ccu_tab(ss)
    ws.append_row([timestamp, ccu_value, is_sale, is_free_weekend, False])


@_retry_on_quota
def bulk_append_ccu(ss: gspread.Spreadsheet, rows: list[list]):
    """rows: [[timestamp, ccu_value, is_sale, is_free_weekend, is_archived_gap], ...]"""
    ws = get_or_create_ccu_tab(ss)
    ws.append_rows(rows)
