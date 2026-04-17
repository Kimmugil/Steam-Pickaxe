"""
RAW_REVIEWS_{appid} 스프레드시트 읽기/쓰기
게임별 별도 파일, 연도별 탭 분리
프론트엔드가 직접 읽지 않음 — AI 분석 시에만 백엔드가 사용
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
    "https://www.googleapis.com/auth/drive",
]

RAW_HEADERS = [
    "recommendationid", "voted_up", "language", "review",
    "timestamp_created", "playtime_at_review", "votes_up", "votes_funny",
]

def get_client() -> gspread.Client:
    creds = Credentials.from_service_account_info(get_google_creds(), scopes=SCOPES)
    return gspread.authorize(creds)

def get_or_create_raw_spreadsheet(drive_folder_id: str, appid: str, name: str) -> gspread.Spreadsheet:
    """
    서비스 계정 My Drive 용량 문제를 피하기 위해,
    파일 생성부터 사용자 공유 폴더에 직접 수행.
    """
    client = get_client()
    title = f"RAW_REVIEWS_{appid}_{name}"

    from googleapiclient.discovery import build
    from google.oauth2.service_account import Credentials as SACredentials
    sa_creds = SACredentials.from_service_account_info(get_google_creds(), scopes=SCOPES)
    drive_service = build("drive", "v3", credentials=sa_creds)

    # 1. 폴더 내 기존 파일 검색 (appid 기준, 게임명 변경에도 안전)
    if drive_folder_id:
        query = (
            f"name contains 'RAW_REVIEWS_{appid}' "
            f"and '{drive_folder_id}' in parents "
            f"and trashed=false"
        )
        results = drive_service.files().list(q=query, fields="files(id,name)").execute()
        existing = results.get("files", [])
        if existing:
            return client.open_by_key(existing[0]["id"])

        # 2. 없으면 사용자 폴더에 직접 생성 (서비스 계정 My Drive 사용 안 함)
        file_metadata = {
            "name": title,
            "mimeType": "application/vnd.google-apps.spreadsheet",
            "parents": [drive_folder_id],
        }
        file = drive_service.files().create(
            body=file_metadata,
            fields="id",
            supportsAllDrives=True,
        ).execute()
        return client.open_by_key(file["id"])

    # folder_id 없으면 서비스 계정 Drive에 생성 (fallback)
    return client.create(title)

def get_or_create_year_tab(ss: gspread.Spreadsheet, year: int) -> gspread.Worksheet:
    tab_name = f"reviews_{year}"
    try:
        ws = ss.worksheet(tab_name)
    except gspread.WorksheetNotFound:
        ws = ss.add_worksheet(title=tab_name, rows=300000, cols=len(RAW_HEADERS))
        ws.append_row(RAW_HEADERS)
        try:
            default_ws = ss.worksheet("Sheet1")
            ss.del_worksheet(default_ws)
        except Exception:
            pass
    return ws

def get_existing_ids(ss: gspread.Spreadsheet, year: int) -> set:
    try:
        ws = get_or_create_year_tab(ss, year)
        col = ws.col_values(1)[1:]
        return set(col)
    except Exception:
        return set()

def append_reviews(ss: gspread.Spreadsheet, reviews: list[dict]) -> int:
    """중복 제외 후 신규 리뷰만 추가, 추가된 건수 반환"""
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

def get_reviews_in_range(ss: gspread.Spreadsheet, start_ts: int, end_ts: int, years: list[int]) -> list[dict]:
    """특정 기간의 리뷰를 가져와 Gemini 분석용으로 반환"""
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
