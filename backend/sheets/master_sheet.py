"""
MASTER_SPREADSHEET 읽기/쓰기 전담 모듈
프론트엔드가 실제로 읽는 파일이므로 스키마 변경에 주의
"""
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime, date
from typing import Optional
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import get_google_creds, MASTER_SPREADSHEET_ID

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

def get_client() -> gspread.Client:
    creds = Credentials.from_service_account_info(get_google_creds(), scopes=SCOPES)
    return gspread.authorize(creds)

def get_spreadsheet() -> gspread.Spreadsheet:
    return get_client().open_by_key(MASTER_SPREADSHEET_ID)

# ──────────────────────────────────────────────
# config 탭
# ──────────────────────────────────────────────

def get_config(spreadsheet: gspread.Spreadsheet) -> dict:
    ws = spreadsheet.worksheet("config")
    rows = ws.get_all_values()
    return {r[0]: r[1] for r in rows if len(r) >= 2 and r[0]}

def set_config_value(spreadsheet: gspread.Spreadsheet, key: str, value: str):
    ws = spreadsheet.worksheet("config")
    cell = ws.find(key, in_column=1)
    if cell:
        ws.update_cell(cell.row, 2, value)
    else:
        ws.append_row([key, value])

# ──────────────────────────────────────────────
# games 탭
# ──────────────────────────────────────────────

GAMES_HEADERS = [
    # 식별자 / 기본 정보
    "appid", "name", "name_kr", "thumbnail", "status",
    # 수집 상태
    "collection_started_at", "last_cursor",
    "total_reviews_count", "collected_reviews_count",
    # 이벤트 / 언어
    "last_event_date", "top_languages",
    # AI 결과
    "ai_briefing", "ai_briefing_date",
    "latest_sentiment_rate", "event_count",
    # Steam 기본 메타
    "peak_ccu", "metacritic_score", "is_free", "is_early_access",
    "totalReviews", "release_date",
    # 스토어 스크래핑 메타
    "genres", "developer", "publisher", "price",
    # 내부 참조
    "game_sheet_id",
    # ── 제거된 컬럼 (하위호환 기록용, 실제로 사용하지 않음) ──
    # owners_estimate, avg_playtime, median_playtime, active_players_2weeks
    #   → SteamSpy 필드였으나 SteamSpy 수집 중단으로 미사용
]

# 실제 시트에서 제거할 구형 컬럼 목록 (ensure_games_headers 가 자동 삭제)
_DEPRECATED_COLUMNS = ["owners_estimate", "avg_playtime", "median_playtime", "active_players_2weeks"]


def ensure_games_headers(spreadsheet: gspread.Spreadsheet):
    """
    games 시트 헤더를 GAMES_HEADERS 기준으로 자동 마이그레이션합니다.

    1. 누락 컬럼 추가: GAMES_HEADERS에 있지만 시트에 없는 컬럼을 오른쪽에 추가
    2. 구형 컬럼 삭제: _DEPRECATED_COLUMNS에 있는 컬럼을 시트에서 제거
       (안전을 위해 해당 컬럼의 데이터가 모두 비어있을 때만 삭제)
    """
    import time as _time

    ws = spreadsheet.worksheet("games")
    current = ws.row_values(1)

    # ── 1. 누락 컬럼 추가 ────────────────────────────────────
    missing = [h for h in GAMES_HEADERS if h not in current]
    if missing:
        print(f"[migrate] games 누락 컬럼 추가: {missing}")
        needed_cols = len(current) + len(missing)
        # 시트 컬럼 수가 부족하면 먼저 확장
        if needed_cols > ws.col_count:
            spreadsheet.batch_update({
                "requests": [{
                    "updateSheetProperties": {
                        "properties": {
                            "sheetId": ws.id,
                            "gridProperties": {"columnCount": needed_cols + 5},
                        },
                        "fields": "gridProperties.columnCount",
                    }
                }]
            })
            print(f"[migrate] games 시트 컬럼 수 확장: {ws.col_count} → {needed_cols + 5}")
            _time.sleep(1)
        next_col = len(current) + 1
        for i, col_name in enumerate(missing):
            ws.update_cell(1, next_col + i, col_name)
        print(f"[migrate] {len(missing)}개 컬럼 추가 완료")
        _time.sleep(1)
        current = ws.row_values(1)  # 헤더 재조회

    # ── 2. 구형 컬럼 삭제 ────────────────────────────────────
    # 컬럼을 뒤에서 앞 순서로 삭제해야 인덱스 밀림 없음
    cols_to_delete = []
    for col_name in _DEPRECATED_COLUMNS:
        if col_name not in current:
            continue
        col_idx = current.index(col_name)  # 0-based
        # 해당 컬럼 데이터 전체 읽기 (헤더 제외)
        col_letter = chr(ord("A") + col_idx)
        try:
            col_values = ws.col_values(col_idx + 1)[1:]  # 헤더 제외
        except Exception:
            col_values = []
        non_empty = [v for v in col_values if str(v).strip()]
        if non_empty:
            print(f"[migrate] '{col_name}' 컬럼에 데이터 있음({len(non_empty)}건) — 삭제 건너뜀")
        else:
            cols_to_delete.append(col_idx)

    if cols_to_delete:
        ss_id = spreadsheet.id
        sheet_id = ws.id
        # 뒤에서 앞 순서로 삭제 (인덱스 밀림 방지)
        requests = [
            {
                "deleteDimension": {
                    "range": {
                        "sheetId": sheet_id,
                        "dimension": "COLUMNS",
                        "startIndex": col_idx,
                        "endIndex": col_idx + 1,
                    }
                }
            }
            for col_idx in sorted(cols_to_delete, reverse=True)
        ]
        spreadsheet.batch_update({"requests": requests})
        deleted_names = [current[i] for i in cols_to_delete]
        print(f"[migrate] 구형 컬럼 삭제 완료: {deleted_names}")

def get_all_games(spreadsheet: gspread.Spreadsheet) -> list[dict]:
    ws = spreadsheet.worksheet("games")
    rows = ws.get_all_records()
    return rows

def get_game(spreadsheet: gspread.Spreadsheet, appid: str) -> Optional[dict]:
    games = get_all_games(spreadsheet)
    for g in games:
        if str(g.get("appid")) == str(appid):
            return g
    return None

def add_game(spreadsheet: gspread.Spreadsheet, game: dict):
    ws = spreadsheet.worksheet("games")
    row = [game.get(h, "") for h in GAMES_HEADERS]
    ws.append_row(row)

def update_game(spreadsheet: gspread.Spreadsheet, appid: str, updates: dict):
    ws = spreadsheet.worksheet("games")
    records = ws.get_all_records()
    headers = ws.row_values(1)
    for i, rec in enumerate(records):
        if str(rec.get("appid")) == str(appid):
            row_idx = i + 2
            for key, val in updates.items():
                if key in headers:
                    col_idx = headers.index(key) + 1
                    ws.update_cell(row_idx, col_idx, val)
            return
    raise ValueError(f"appid {appid} not found in games tab")

# ──────────────────────────────────────────────
# timeline_{appid} 탭
# ──────────────────────────────────────────────

TIMELINE_HEADERS = [
    "event_id", "event_type", "date", "title", "language_scope",
    "sentiment_rate", "review_count", "ai_patch_summary",
    "ai_reaction_summary", "top_keywords", "top_reviews", "url",
    "is_sale_period", "sale_text", "is_free_weekend",
]

def get_or_create_timeline_tab(spreadsheet: gspread.Spreadsheet, appid: str) -> gspread.Worksheet:
    tab_name = f"timeline_{appid}"
    try:
        ws = spreadsheet.worksheet(tab_name)
    except gspread.WorksheetNotFound:
        ws = spreadsheet.add_worksheet(title=tab_name, rows=1000, cols=len(TIMELINE_HEADERS))
        ws.append_row(TIMELINE_HEADERS)
    return ws

def get_timeline(spreadsheet: gspread.Spreadsheet, appid: str) -> list[dict]:
    ws = get_or_create_timeline_tab(spreadsheet, appid)
    return ws.get_all_records()

def append_timeline_row(spreadsheet: gspread.Spreadsheet, appid: str, row: dict):
    ws = get_or_create_timeline_tab(spreadsheet, appid)
    ws.append_row([row.get(h, "") for h in TIMELINE_HEADERS])

def delete_timeline_rows_by_event(spreadsheet: gspread.Spreadsheet, appid: str, event_id: str):
    ws = get_or_create_timeline_tab(spreadsheet, appid)
    records = ws.get_all_records()
    rows_to_delete = [i + 2 for i, r in enumerate(records) if str(r.get("event_id")) == str(event_id)]
    for row_idx in sorted(rows_to_delete, reverse=True):
        ws.delete_rows(row_idx)

def update_timeline_row(spreadsheet: gspread.Spreadsheet, appid: str, event_id: str, language_scope: str, updates: dict):
    ws = get_or_create_timeline_tab(spreadsheet, appid)
    records = ws.get_all_records()
    headers = ws.row_values(1)
    for i, rec in enumerate(records):
        if str(rec.get("event_id")) == str(event_id) and str(rec.get("language_scope")) == language_scope:
            row_idx = i + 2
            for key, val in updates.items():
                if key in headers:
                    col_idx = headers.index(key) + 1
                    ws.update_cell(row_idx, col_idx, val)
            return

# ──────────────────────────────────────────────
# ccu_{appid} 탭
# ──────────────────────────────────────────────

CCU_HEADERS = ["timestamp", "ccu_value", "is_sale_period", "is_free_weekend", "is_archived_gap"]

def get_or_create_ccu_tab(spreadsheet: gspread.Spreadsheet, appid: str) -> gspread.Worksheet:
    tab_name = f"ccu_{appid}"
    try:
        ws = spreadsheet.worksheet(tab_name)
    except gspread.WorksheetNotFound:
        ws = spreadsheet.add_worksheet(title=tab_name, rows=10000, cols=len(CCU_HEADERS))
        ws.append_row(CCU_HEADERS)
    return ws

def append_ccu(spreadsheet: gspread.Spreadsheet, appid: str, timestamp: str, ccu_value: int,
               is_sale: bool = False, is_free_weekend: bool = False):
    ws = get_or_create_ccu_tab(spreadsheet, appid)
    ws.append_row([timestamp, ccu_value, is_sale, is_free_weekend, False])

def get_ccu_data(spreadsheet: gspread.Spreadsheet, appid: str) -> list[dict]:
    ws = get_or_create_ccu_tab(spreadsheet, appid)
    return ws.get_all_records()

def bulk_append_ccu(spreadsheet: gspread.Spreadsheet, appid: str, rows: list[list]):
    """rows: [[timestamp, ccu_value, is_sale, is_free_weekend, is_archived_gap], ...]"""
    ws = get_or_create_ccu_tab(spreadsheet, appid)
    ws.append_rows(rows)
