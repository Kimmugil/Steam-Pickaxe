"""
sheet_pool.py — 사전 할당 시트 풀 관리

[왜 이 시스템이 필요한가]
서비스 계정은 Google이 부여한 0GB 저장 공간을 가지며, 파일 소유자가
서비스 계정인 경우 Drive API로 파일 생성 자체가 403으로 차단됩니다.
(공유 폴더에 직접 생성해도 '소유권'은 서비스 계정에 귀속되어 동일하게 실패)

[해결책: Sheet Pool]
관리자(김무길)가 사람 계정으로 Google Sheets 파일을 미리 생성해 두고
Master 시트의 'Sheet_Pool' 탭에 등록합니다.
코드는 파일을 만들지 않고, 풀에서 비어있는 시트를 꺼내 AppID에 할당합니다.

[Sheet_Pool 탭 컬럼 구조]
  A: sheet_id      — 스프레드시트 ID 또는 전체 URL (둘 다 허용)
  B: assigned_appid — 할당된 AppID (비어 있으면 미할당)
  C: status         — "Empty" 또는 "Used"

[관리자가 해야 할 일]
1. Google Sheets 파일을 원하는 수만큼 생성 (예: RAW_POOL_01, RAW_POOL_02, ...)
2. 해당 파일들에 서비스 계정 이메일을 편집자로 공유
3. 각 파일의 URL 또는 ID를 Sheet_Pool 탭에 붙여넣고 status = Empty 설정
"""

import re
import gspread
from google.oauth2.service_account import Credentials
from typing import Optional
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import get_google_creds

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
]

POOL_TAB = "Sheet_Pool"
POOL_HEADERS = ["sheet_id", "assigned_appid", "status"]


def _extract_sheet_id(raw: str) -> str:
    """
    URL 또는 ID 문자열에서 스프레드시트 ID만 추출.
    전체 URL (https://docs.google.com/spreadsheets/d/ID/edit) 도 처리 가능.
    """
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", raw)
    if match:
        return match.group(1)
    return raw.strip()


def get_pool_worksheet(ss: gspread.Spreadsheet) -> gspread.Worksheet:
    """
    Sheet_Pool 탭 반환. 없으면 헤더만 있는 빈 탭 생성.
    빈 탭이 생성된 경우 관리자가 직접 시트 ID를 채워야 합니다.
    """
    try:
        return ss.worksheet(POOL_TAB)
    except gspread.WorksheetNotFound:
        ws = ss.add_worksheet(title=POOL_TAB, rows=100, cols=3)
        ws.append_row(POOL_HEADERS)
        print(f"[POOL] '{POOL_TAB}' 탭이 없어 새로 생성했습니다. 관리자가 시트 ID를 등록해야 합니다.")
        return ws


def get_allocated_sheet_id(ss: gspread.Spreadsheet, appid: str) -> Optional[str]:
    """
    이미 이 appid에 할당된 시트가 있으면 해당 sheet_id 반환.
    없으면 None.
    """
    ws = get_pool_worksheet(ss)
    records = ws.get_all_records()
    for rec in records:
        if str(rec.get("assigned_appid", "")).strip() == str(appid):
            raw_id = str(rec.get("sheet_id", "")).strip()
            if raw_id:
                return _extract_sheet_id(raw_id)
    return None


def allocate_sheet(ss: gspread.Spreadsheet, appid: str) -> Optional[str]:
    """
    풀에서 비어있는 시트를 찾아 appid에 할당하고 sheet_id 반환.

    - 이미 할당된 시트가 있으면 재사용 (멱등성 보장).
    - 빈 시트가 없으면 None 반환 → 호출자가 error_pool_empty 처리.

    Returns:
        str  : 할당된 스프레드시트 ID
        None : 사용 가능한 시트 없음 (풀 고갈)
    """
    ws = get_pool_worksheet(ss)
    records = ws.get_all_records()
    headers = ws.row_values(1)

    # 헤더 컬럼 인덱스 (1-based)
    try:
        col_sheet_id   = headers.index("sheet_id") + 1
        col_appid      = headers.index("assigned_appid") + 1
        col_status     = headers.index("status") + 1
    except ValueError as e:
        print(f"[POOL ERROR] Sheet_Pool 탭 헤더 오류: {e}")
        return None

    # 1순위: 이미 이 appid에 할당된 시트가 있으면 재사용 (재시작/재시도 안전)
    for i, rec in enumerate(records):
        if str(rec.get("assigned_appid", "")).strip() == str(appid):
            raw_id = str(rec.get("sheet_id", "")).strip()
            sid = _extract_sheet_id(raw_id) if raw_id else None
            if sid:
                print(f"[POOL] appid={appid} 기존 할당 시트 재사용: {sid}")
                return sid

    # 2순위: Status=Empty이고 assigned_appid가 비어 있는 첫 번째 행 할당
    for i, rec in enumerate(records):
        is_empty_status = rec.get("status", "").strip().lower() == "empty"
        is_unassigned   = not str(rec.get("assigned_appid", "")).strip()
        raw_id          = str(rec.get("sheet_id", "")).strip()

        if is_empty_status and is_unassigned and raw_id:
            row_idx = i + 2  # 헤더 행(1) + 0-based offset
            sid = _extract_sheet_id(raw_id)

            # 할당 기록 (두 셀 업데이트)
            ws.update_cell(row_idx, col_appid,  str(appid))
            ws.update_cell(row_idx, col_status, "Used")

            print(f"[POOL] appid={appid} 신규 시트 할당: {sid}")
            return sid

    # 풀 고갈
    print(f"[POOL EMPTY] appid={appid} — Sheet_Pool에 사용 가능한 시트가 없습니다.")
    print("[POOL EMPTY] 관리자가 Sheet_Pool 탭에 새 시트 ID를 추가하고 status=Empty로 설정해야 합니다.")
    return None


def release_sheet(ss: gspread.Spreadsheet, appid: str) -> bool:
    """
    appid에 할당된 시트를 풀에 반환 (Empty로 초기화).
    게임 삭제 시 호출하면 시트를 재사용할 수 있습니다.

    Returns:
        True  : 성공적으로 반환됨
        False : 해당 appid의 할당 없음
    """
    ws = get_pool_worksheet(ss)
    records = ws.get_all_records()
    headers = ws.row_values(1)

    try:
        col_appid  = headers.index("assigned_appid") + 1
        col_status = headers.index("status") + 1
    except ValueError:
        return False

    for i, rec in enumerate(records):
        if str(rec.get("assigned_appid", "")).strip() == str(appid):
            row_idx = i + 2
            ws.update_cell(row_idx, col_appid,  "")
            ws.update_cell(row_idx, col_status, "Empty")
            print(f"[POOL] appid={appid} 시트 풀에 반환 완료")
            return True

    return False


def get_pool_status(ss: gspread.Spreadsheet) -> dict:
    """
    풀 현황 요약 반환 (디버깅/모니터링용).
    Returns: { "total": int, "empty": int, "used": int }
    """
    ws = get_pool_worksheet(ss)
    records = ws.get_all_records()
    total = len(records)
    used  = sum(1 for r in records if r.get("status", "").lower() == "used")
    empty = sum(1 for r in records if r.get("status", "").lower() == "empty")
    return {"total": total, "empty": empty, "used": used}
