"""
raw_reviews.py — RAW 리뷰 시트 읽기/쓰기

[파일 생성 방식]
서비스 계정은 Drive 저장 공간이 0GB이므로 직접 파일 생성이 불가능합니다.
대신 Google Apps Script(GAS) 웹앱에 HTTP POST 요청을 보내,
관리자(김무길) 계정 권한으로 파일을 생성하고 서비스 계정에 편집 권한을 부여합니다.

흐름:
  1. get_or_create_raw_spreadsheet(folder_id, appid, name)
     → GAS 웹앱 POST → 관리자 계정으로 파일 생성 + 서비스 계정에 Editor 권한 부여
     → spreadsheetId 반환
  2. gspread 클라이언트로 해당 시트 열기 (서비스 계정 편집 권한으로 읽기/쓰기)
  3. append_reviews() / get_reviews_in_range() 등 기존 함수 그대로 사용

환경변수:
  GAS_WEBAPP_URL  — gas/DEPLOY_GUIDE.md 참조하여 배포 후 등록
  GOOGLE_SERVICE_ACCOUNT_JSON — 서비스 계정 JSON (기존과 동일)
"""

import gspread
import requests
from google.oauth2.service_account import Credentials
from datetime import datetime
from typing import Optional
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import get_google_creds, GAS_WEBAPP_URL

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
]

RAW_HEADERS = [
    "recommendationid", "voted_up", "language", "review",
    "timestamp_created", "playtime_at_review", "votes_up", "votes_funny",
]

# 서비스 계정 이메일 (GAS에 편집 권한 부여 요청 시 사용)
def _get_service_account_email() -> str:
    creds_info = get_google_creds()
    return creds_info.get("client_email", "")


def _get_client() -> gspread.Client:
    creds = Credentials.from_service_account_info(get_google_creds(), scopes=SCOPES)
    return gspread.authorize(creds)


def get_or_create_raw_spreadsheet(
    drive_folder_id: str,
    appid: str,
    name: str,
) -> gspread.Spreadsheet:
    """
    RAW 리뷰 스프레드시트를 가져오거나 새로 생성합니다.

    파일 생성은 GAS 웹앱에 위임합니다:
    - GAS가 관리자 계정으로 파일 생성 → 서비스 계정에 편집 권한 부여
    - 서비스 계정은 gspread로 열기만 수행 (Drive 할당량 소모 없음)

    Args:
        drive_folder_id: 파일을 저장할 Google Drive 폴더 ID
        appid: Steam AppID
        name: 게임 이름 (파일명에 포함)

    Returns:
        gspread.Spreadsheet: 열린 스프레드시트 객체

    Raises:
        RuntimeError: GAS_WEBAPP_URL 미설정 또는 GAS 호출 실패
    """
    file_name = f"RAW_REVIEWS_{appid}_{name}"
    sa_email  = _get_service_account_email()

    if not GAS_WEBAPP_URL:
        raise RuntimeError(
            "[raw_reviews] GAS_WEBAPP_URL 환경변수가 설정되지 않았습니다.\n"
            "gas/DEPLOY_GUIDE.md를 참고해 GAS 웹앱을 배포하고\n"
            ".env 및 GitHub Secrets에 GAS_WEBAPP_URL을 추가하세요."
        )

    # ── GAS 웹앱에 파일 생성 요청 ────────────────────────────────────────────
    payload = {
        "folderId":             drive_folder_id,
        "fileName":             file_name,
        "serviceAccountEmail":  sa_email,
    }

    try:
        resp = requests.post(
            GAS_WEBAPP_URL,
            json=payload,
            timeout=30,
            # GAS 웹앱은 리다이렉트를 사용하므로 follow_redirects 필요
            allow_redirects=True,
        )
        resp.raise_for_status()
        result = resp.json()
    except requests.exceptions.Timeout:
        raise RuntimeError("[raw_reviews] GAS 웹앱 요청 시간 초과 (30초). 나중에 재시도하세요.")
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"[raw_reviews] GAS 웹앱 HTTP 오류: {e}")
    except ValueError:
        raise RuntimeError(f"[raw_reviews] GAS 응답 파싱 실패. 응답: {resp.text[:200]}")

    if not result.get("ok"):
        raise RuntimeError(f"[raw_reviews] GAS 웹앱 오류: {result.get('error', '알 수 없는 오류')}")

    spreadsheet_id = result.get("spreadsheetId")
    if not spreadsheet_id:
        raise RuntimeError("[raw_reviews] GAS 응답에 spreadsheetId가 없습니다.")

    reused = result.get("reused", False)
    print(f"[RAW SHEET] {'재사용' if reused else '신규 생성'}: {spreadsheet_id} ({file_name})")

    # ── 서비스 계정으로 시트 열기 ─────────────────────────────────────────────
    client = _get_client()
    return client.open_by_key(spreadsheet_id)


def open_raw_spreadsheet(sheet_id: str) -> gspread.Spreadsheet:
    """
    알려진 sheet_id로 RAW 스프레드시트를 직접 엽니다.
    (GAS를 거치지 않고 이미 할당된 시트를 열 때 사용)
    """
    return _get_client().open_by_key(sheet_id)


def get_or_create_year_tab(ss: gspread.Spreadsheet, year: int) -> gspread.Worksheet:
    """연도별 탭 반환. 없으면 헤더 포함 신규 생성."""
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
    """해당 연도 탭의 recommendationid 집합 반환 (중복 방지)."""
    try:
        ws = get_or_create_year_tab(ss, year)
        col = ws.col_values(1)[1:]
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
    """특정 기간의 리뷰를 Gemini 분석용으로 반환."""
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
