"""
raw_reviews.py — RAW 리뷰 시트 읽기/쓰기

[중요] 이 모듈은 더 이상 스프레드시트 파일을 생성하지 않습니다.
서비스 계정의 Drive 저장 공간이 0GB이므로 파일 생성 시 403 오류가 발생합니다.
대신 Sheet_Pool 시스템을 통해 관리자가 사전 생성한 시트를 사용합니다.

사용 흐름:
  1. sheet_pool.allocate_sheet(ss_master, appid) → sheet_id 반환
  2. open_raw_spreadsheet(sheet_id) → gspread.Spreadsheet 반환
  3. append_reviews(raw_ss, reviews) → 리뷰 데이터 추가
"""

import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime
from typing import Optional
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import get_google_creds

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
]

RAW_HEADERS = [
    "recommendationid", "voted_up", "language", "review",
    "timestamp_created", "playtime_at_review", "votes_up", "votes_funny",
]


def _get_client() -> gspread.Client:
    creds = Credentials.from_service_account_info(get_google_creds(), scopes=SCOPES)
    return gspread.authorize(creds)


def open_raw_spreadsheet(sheet_id: str) -> gspread.Spreadsheet:
    """
    Sheet_Pool에서 할당된 sheet_id로 스프레드시트를 엽니다.
    파일 생성을 하지 않으므로 Drive 저장 공간 초과 문제 없음.

    Args:
        sheet_id: 스프레드시트 ID (URL이 아닌 순수 ID여야 함 — sheet_pool이 정규화함)

    Raises:
        gspread.exceptions.SpreadsheetNotFound: 해당 시트 접근 불가
    """
    client = _get_client()
    return client.open_by_key(sheet_id)


def get_or_create_year_tab(ss: gspread.Spreadsheet, year: int) -> gspread.Worksheet:
    """연도별 탭 반환. 없으면 헤더 포함 신규 생성."""
    tab_name = f"reviews_{year}"
    try:
        ws = ss.worksheet(tab_name)
    except gspread.WorksheetNotFound:
        ws = ss.add_worksheet(title=tab_name, rows=300000, cols=len(RAW_HEADERS))
        ws.append_row(RAW_HEADERS)
        # 새 시트 기본 탭(Sheet1) 제거
        try:
            default_ws = ss.worksheet("Sheet1")
            ss.del_worksheet(default_ws)
        except Exception:
            pass
    return ws


def get_existing_ids(ss: gspread.Spreadsheet, year: int) -> set:
    """해당 연도 탭의 recommendationid 집합 반환 (중복 방지용)."""
    try:
        ws = get_or_create_year_tab(ss, year)
        col = ws.col_values(1)[1:]  # 헤더 제외
        return set(col)
    except Exception:
        return set()


def append_reviews(ss: gspread.Spreadsheet, reviews: list[dict]) -> int:
    """
    중복을 제외한 신규 리뷰만 연도별 탭에 추가합니다.

    Returns:
        int: 실제로 추가된 리뷰 건수
    """
    by_year: dict[int, list] = {}
    for r in reviews:
        ts = int(r.get("timestamp_created", 0))
        year = datetime.utcfromtimestamp(ts).year if ts else datetime.utcnow().year
        by_year.setdefault(year, []).append(r)

    added = 0
    for year, batch in by_year.items():
        existing = get_existing_ids(ss, year)
        ws = get_or_create_year_tab(ss, year)
        new_rows = []
        for r in batch:
            rid = str(r.get("recommendationid", ""))
            if rid and rid not in existing:
                new_rows.append([
                    rid,
                    r.get("voted_up", False),
                    r.get("language", ""),
                    r.get("review", ""),
                    r.get("timestamp_created", ""),
                    r.get("playtime_forever", 0),
                    r.get("votes_up", 0),
                    r.get("votes_funny", 0),
                ])
                existing.add(rid)
        if new_rows:
            ws.append_rows(new_rows)
            added += len(new_rows)
    return added


def get_reviews_in_range(
    ss: gspread.Spreadsheet,
    start_ts: int,
    end_ts: int,
    years: list[int],
) -> list[dict]:
    """특정 기간의 리뷰를 가져와 Gemini 분석용으로 반환."""
    results = []
    for year in years:
        try:
            ws = get_or_create_year_tab(ss, year)
            records = ws.get_all_records()
            for r in records:
                ts = int(r.get("timestamp_created", 0))
                if start_ts <= ts <= end_ts:
                    results.append(r)
        except Exception:
            continue
    return results
