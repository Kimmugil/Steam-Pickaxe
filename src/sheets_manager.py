"""
Google Sheets 연동 모듈
─────────────────────────────────────────────────────
구조 (단일 스프레드시트):
  [Steam-Pickaxe-Data]  ← 유저가 직접 생성, ID를 secrets에 등록
    ├ 시트: 게임목록           ← 게임 목록 + 수집 상태
    ├ 시트: reviews_{appid}    ← 리뷰 원본 전체 적재
    └ 시트: timeline_{appid}   ← 타임라인 이벤트 데이터

서비스 계정은 파일을 생성하지 않으며, 워크시트 추가/읽기/쓰기만 합니다.
"""

import json
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime, timezone
from typing import Optional

from .config import get_google_credentials, get_env

# ─────────────────────────────────────────────
#  상수
# ─────────────────────────────────────────────
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",  # 시트 읽기/쓰기만 (Drive 스코프 불필요)
]

# 마스터 시트 컬럼 (게임 목록)
MASTER_COLUMNS = [
    "appid",             # Steam App ID
    "name",              # 게임명 (한국어/원제)
    "name_en",           # 게임명 (영어)
    "release_date",      # 출시일 (YYYY-MM-DD)
    "last_cursor",       # 마지막 수집 cursor (* 이면 처음부터)
    "last_pickaxe_run",  # 마지막 스팀곡괭이 실행 시각 (ISO)
    "total_archived",    # 적재된 총 리뷰 수
    "status",            # active / paused
]

# 리뷰 아카이브 컬럼
REVIEW_COLUMNS = [
    "review_id",                    # Steam 리뷰 고유 ID (recommendationid)
    "steamid",                      # 작성자 Steam ID
    "language",                     # 리뷰 작성 언어
    "voted_up",                     # 긍정 여부 (TRUE / FALSE)
    "votes_up",                     # 도움됨 투표 수
    "votes_funny",                  # 재밌음 투표 수
    "weighted_vote_score",          # Steam 가중치 점수 (0~1)
    "review",                       # 리뷰 전문
    "timestamp_created",            # 작성 시각 (Unix timestamp)
    "timestamp_updated",            # 최근 수정 시각 (Unix timestamp)
    "playtime_at_review",           # 리뷰 시점 플레이타임 (분)
    "playtime_forever",             # 총 플레이타임 (분)
    "received_for_free",            # 무료 수령 여부
    "written_during_early_access",  # 얼리액세스 중 작성 여부
    "author_num_reviews",           # 작성자 총 리뷰 수
    "collected_at",                 # 수집 시각 (ISO 8601, UTC)
]

# 타임라인 이벤트 컬럼
TIMELINE_COLUMNS = [
    "event_id",          # 이벤트 고유 ID (evt_001)
    "name",              # 이벤트명
    "date",              # 이벤트 발생일 (YYYY-MM-DD)
    "period_end",        # 영향 기간 종료일
    "type",              # launch / update / crisis / controversy / recovery
    "type_label",        # 한글 표시명
    "sentiment_pct",     # 긍정 비율 (%)
    "review_count",      # 해당 기간 리뷰 수
    "description",       # 이벤트 설명
    "key_issues",        # 주요 이슈 (파이프 | 구분)
    "top_langs",         # TOP 언어 (파이프 | 구분)
    "kr_summary",        # 한국어 유저 반응 요약
    "color",             # 카드 색상 코드
    "user_edited",       # 유저가 수정했는지 여부 (TRUE/FALSE)
    "source_url",        # 이벤트 근거 패치노트/뉴스 URL
    "top_reviews",       # 해당 기간 대표 리뷰 JSON 배열 문자열
    "generation_uuid",   # 타임라인 생성 UUID (8자)
    "created_at",        # 최초 생성 시각 (ISO)
    "updated_at",        # 최근 수정 시각 (ISO)
]

# 타임라인 버전 히스토리 워크시트 컬럼
TL_HISTORY_COLUMNS = ["uuid", "created_at", "based_on_reviews", "based_on_news", "event_count", "events_json"]


# ─────────────────────────────────────────────
#  클라이언트 & 스프레드시트 열기
# ─────────────────────────────────────────────
def get_client() -> gspread.Client:
    """Google Sheets 인증 클라이언트를 반환합니다. 429 자동 재시도 포함."""
    creds_dict = get_google_credentials()
    creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
    try:
        from gspread.http_client import BackoffHTTPClient
        gc = gspread.Client(auth=creds, http_client=BackoffHTTPClient)
        gc.login()
        return gc
    except Exception:
        # gspread 버전 호환 폴백
        return gspread.authorize(creds)


def _get_master_spreadsheet(client: gspread.Client) -> gspread.Spreadsheet:
    """
    마스터 스프레드시트를 ID로 직접 엽니다.
    MASTER_SPREADSHEET_ID가 없으면 ValueError를 발생시킵니다.
    """
    spreadsheet_id = get_env("MASTER_SPREADSHEET_ID")
    if not spreadsheet_id:
        raise ValueError(
            "MASTER_SPREADSHEET_ID가 설정되지 않았습니다.\n"
            "Streamlit Secrets 또는 환경변수에 MASTER_SPREADSHEET_ID를 추가하세요."
        )
    return client.open_by_key(spreadsheet_id)


def _ensure_game_list_ws(ss: gspread.Spreadsheet) -> gspread.Worksheet:
    """'게임목록' 워크시트를 반환하고 없으면 생성합니다."""
    try:
        return ss.worksheet("게임목록")
    except gspread.WorksheetNotFound:
        ws = ss.add_worksheet("게임목록", rows=500, cols=len(MASTER_COLUMNS))
        ws.append_row(MASTER_COLUMNS)
        ws.freeze(rows=1)
        return ws


# ─────────────────────────────────────────────
#  게임 목록 조회
# ─────────────────────────────────────────────
def get_all_tracked_games(client: gspread.Client) -> list[dict]:
    """마스터 스프레드시트에서 모든 게임 목록을 반환합니다."""
    ss = _get_master_spreadsheet(client)
    ws = _ensure_game_list_ws(ss)
    return ws.get_all_records()


def get_game_info(client: gspread.Client, appid: int) -> Optional[dict]:
    """마스터 시트에서 특정 게임 정보를 조회합니다."""
    games = get_all_tracked_games(client)
    for g in games:
        if str(g.get("appid")) == str(appid):
            return g
    return None


# ─────────────────────────────────────────────
#  게임 등록
# ─────────────────────────────────────────────
def register_game(
    client: gspread.Client,
    appid: int,
    name: str,
    name_en: str,
    release_date: str,
) -> None:
    """
    새 게임을 마스터 시트에 등록하고 리뷰/타임라인 워크시트를 생성합니다.
    모든 작업이 MASTER_SPREADSHEET_ID 스프레드시트 안에서 이루어집니다.
    """
    ss = _get_master_spreadsheet(client)

    # reviews_{appid} 워크시트 생성
    review_ws_name = f"reviews_{appid}"
    try:
        review_ws = ss.worksheet(review_ws_name)
    except gspread.WorksheetNotFound:
        review_ws = ss.add_worksheet(review_ws_name, rows=1000, cols=len(REVIEW_COLUMNS))
        review_ws.append_row(REVIEW_COLUMNS)
        review_ws.freeze(rows=1)

    # timeline_{appid} 워크시트 생성
    timeline_ws_name = f"timeline_{appid}"
    try:
        ss.worksheet(timeline_ws_name)
    except gspread.WorksheetNotFound:
        timeline_ws = ss.add_worksheet(timeline_ws_name, rows=500, cols=len(TIMELINE_COLUMNS))
        timeline_ws.append_row(TIMELINE_COLUMNS)
        timeline_ws.freeze(rows=1)

    # 게임목록 워크시트에 등록
    game_list_ws = _ensure_game_list_ws(ss)

    # 이미 등록되어 있는지 확인
    existing = game_list_ws.get_all_records()
    if any(str(g.get("appid")) == str(appid) for g in existing):
        return  # 중복 등록 방지

    game_list_ws.append_row([
        str(appid),
        name,
        name_en,
        release_date,
        "*",   # last_cursor: 처음부터 수집
        "",    # last_pickaxe_run
        0,     # total_archived
        "active",
    ])


def update_master_after_collect(
    client: gspread.Client,
    appid: int,
    new_cursor: str,
    added_count: int,
) -> None:
    """리뷰 수집 완료 후 게임목록 시트의 cursor와 통계를 업데이트합니다."""
    ss = _get_master_spreadsheet(client)
    ws = _ensure_game_list_ws(ss)
    records = ws.get_all_records()

    for i, row in enumerate(records, start=2):  # 헤더=1행, 데이터=2행~
        if str(row.get("appid")) == str(appid):
            new_total = int(row.get("total_archived") or 0) + added_count
            now_iso = datetime.now(timezone.utc).isoformat()
            # MASTER_COLUMNS 순서: appid, name, name_en, release_date,
            #   last_cursor(E), last_pickaxe_run(F), total_archived(G), status(H)
            ws.update(f"E{i}:G{i}", [[new_cursor, now_iso, new_total]])
            break


# ─────────────────────────────────────────────
#  리뷰 적재 & 조회
# ─────────────────────────────────────────────
def save_reviews(
    client: gspread.Client,
    appid: int,
    reviews: list[dict],
    new_cursor: str,
) -> int:
    """
    새 리뷰를 Google Sheets에 적재합니다. 이미 있는 review_id는 건너뜁니다.

    Returns:
        실제로 새로 적재된 리뷰 수
    """
    ss = _get_master_spreadsheet(client)
    review_ws_name = f"reviews_{appid}"

    try:
        review_ws = ss.worksheet(review_ws_name)
    except gspread.WorksheetNotFound:
        review_ws = ss.add_worksheet(review_ws_name, rows=1000, cols=len(REVIEW_COLUMNS))
        review_ws.append_row(REVIEW_COLUMNS)
        review_ws.freeze(rows=1)

    # 기존 review_id 조회 (중복 방지)
    existing_ids: set[str] = set(r for r in review_ws.col_values(1)[1:] if r)

    new_rows: list[list] = []
    collected_at = datetime.now(timezone.utc).isoformat()

    for rev in reviews:
        rid = str(rev.get("recommendationid", ""))
        if not rid or rid in existing_ids:
            continue

        author = rev.get("author", {})
        new_rows.append([
            rid,
            str(author.get("steamid", "")),
            rev.get("language", ""),
            str(rev.get("voted_up", "")),
            str(rev.get("votes_up", 0)),
            str(rev.get("votes_funny", 0)),
            str(rev.get("weighted_vote_score", 0)),
            rev.get("review", ""),
            str(rev.get("timestamp_created", "")),
            str(rev.get("timestamp_updated", "")),
            str(author.get("playtime_at_review", 0)),
            str(author.get("playtime_forever", 0)),
            str(rev.get("received_for_free", False)),
            str(rev.get("written_during_early_access", False)),
            str(author.get("num_reviews", 0)),
            collected_at,
        ])

    if new_rows:
        review_ws.append_rows(new_rows, value_input_option="RAW")

    update_master_after_collect(client, appid, new_cursor, len(new_rows))
    return len(new_rows)


def load_reviews(
    client: gspread.Client,
    appid: int,
    since_ts: int = 0,
    language: Optional[str] = None,
    max_rows: int = 0,
) -> list[dict]:
    """
    Google Sheets에서 리뷰를 로드합니다.

    Args:
        since_ts: 이 Unix timestamp 이후 작성된 리뷰만 반환 (0이면 전체)
        language: 특정 언어 코드로 필터링 (None이면 전체)
        max_rows: 최대 반환 행 수 (0이면 전체)
    """
    ss = _get_master_spreadsheet(client)
    try:
        review_ws = ss.worksheet(f"reviews_{appid}")
    except gspread.WorksheetNotFound:
        return []

    records = review_ws.get_all_records()

    if since_ts:
        records = [r for r in records if int(r.get("timestamp_created") or 0) > since_ts]
    if language:
        records = [r for r in records if r.get("language") == language]
    if max_rows:
        records = records[:max_rows]

    return records


def get_last_cursor(client: gspread.Client, appid: int) -> str:
    """마스터 시트에서 마지막 수집 cursor를 가져옵니다."""
    game_info = get_game_info(client, appid)
    if not game_info:
        return "*"
    return game_info.get("last_cursor") or "*"


# ─────────────────────────────────────────────
#  타임라인 이벤트 관리
# ─────────────────────────────────────────────
def load_timeline_events(client: gspread.Client, appid: int) -> list[dict]:
    """게임의 타임라인 이벤트를 모두 로드합니다."""
    ss = _get_master_spreadsheet(client)
    try:
        ws = ss.worksheet(f"timeline_{appid}")
    except gspread.WorksheetNotFound:
        return []
    return ws.get_all_records()


def save_timeline_events(
    client: gspread.Client,
    appid: int,
    events: list[dict],
    overwrite: bool = False,
) -> None:
    """
    타임라인 이벤트를 저장합니다.

    Args:
        overwrite: True면 전체 덮어쓰기, False면 event_id 기준 upsert
    """
    ss = _get_master_spreadsheet(client)
    timeline_ws_name = f"timeline_{appid}"

    try:
        ws = ss.worksheet(timeline_ws_name)
    except gspread.WorksheetNotFound:
        ws = ss.add_worksheet(timeline_ws_name, rows=500, cols=len(TIMELINE_COLUMNS))
        ws.append_row(TIMELINE_COLUMNS)
        ws.freeze(rows=1)

    now_iso = datetime.now(timezone.utc).isoformat()

    n_cols = len(TIMELINE_COLUMNS)
    last_col = chr(ord("A") + n_cols - 1)  # e.g. "S" for 19 columns

    def _event_row(e: dict) -> list:
        top_reviews_val = e.get("top_reviews", [])
        if isinstance(top_reviews_val, list):
            top_reviews_str = json.dumps(top_reviews_val, ensure_ascii=False)
        else:
            top_reviews_str = str(top_reviews_val)
        return [
            e.get("event_id", ""),
            e.get("name", ""),
            e.get("date", ""),
            e.get("period_end", ""),
            e.get("type", ""),
            e.get("type_label", ""),
            str(e.get("sentiment_pct", "")),
            str(e.get("review_count", "")),
            e.get("description", ""),
            " | ".join(e.get("key_issues", [])) if isinstance(e.get("key_issues"), list) else e.get("key_issues", ""),
            " | ".join(e.get("top_langs", [])) if isinstance(e.get("top_langs"), list) else e.get("top_langs", ""),
            e.get("kr_summary", ""),
            e.get("color", ""),
            str(e.get("user_edited", False)),
            e.get("source_url", ""),
            top_reviews_str,
            e.get("generation_uuid", ""),
            e.get("created_at", now_iso),
            now_iso,
        ]

    if overwrite:
        ws.clear()
        ws.append_row(TIMELINE_COLUMNS)
        if events:
            ws.append_rows([_event_row(e) for e in events], value_input_option="RAW")
    else:
        existing = ws.get_all_records()
        existing_ids = {r["event_id"]: i + 2 for i, r in enumerate(existing)}

        for e in events:
            eid = e.get("event_id", "")
            row_data = _event_row(e)
            if eid and eid in existing_ids:
                row_num = existing_ids[eid]
                ws.update(f"A{row_num}:{last_col}{row_num}", [row_data])
            else:
                ws.append_row(row_data, value_input_option="RAW")


def update_event_field(
    client: gspread.Client,
    appid: int,
    event_id: str,
    field: str,
    value: str,
) -> bool:
    """
    특정 이벤트의 단일 필드를 업데이트합니다.

    Returns:
        업데이트 성공 여부
    """
    if field not in TIMELINE_COLUMNS:
        raise ValueError(f"알 수 없는 필드: {field}")

    ss = _get_master_spreadsheet(client)
    try:
        ws = ss.worksheet(f"timeline_{appid}")
    except gspread.WorksheetNotFound:
        return False

    records = ws.get_all_records()
    col_idx = TIMELINE_COLUMNS.index(field) + 1

    for i, row in enumerate(records, start=2):
        if row.get("event_id") == event_id:
            ws.update_cell(i, col_idx, value)
            ws.update_cell(i, TIMELINE_COLUMNS.index("updated_at") + 1, datetime.now(timezone.utc).isoformat())
            ws.update_cell(i, TIMELINE_COLUMNS.index("user_edited") + 1, "True")
            return True

    return False


# ─────────────────────────────────────────────
#  타임라인 버전 히스토리
# ─────────────────────────────────────────────
def save_timeline_version(
    client: gspread.Client,
    appid: int,
    uuid: str,
    created_at: str,
    based_on_reviews: int,
    based_on_news: int,
    event_count: int,
    events_json: str,
) -> None:
    """타임라인 생성 이력을 저장합니다."""
    ss = _get_master_spreadsheet(client)
    ws_name = f"tl_hist_{appid}"
    try:
        ws = ss.worksheet(ws_name)
    except gspread.WorksheetNotFound:
        ws = ss.add_worksheet(ws_name, rows=100, cols=len(TL_HISTORY_COLUMNS))
        ws.append_row(TL_HISTORY_COLUMNS)
        ws.freeze(rows=1)
    ws.append_row([uuid, created_at, based_on_reviews, based_on_news, event_count, events_json])


def load_timeline_versions(client: gspread.Client, appid: int) -> list[dict]:
    """타임라인 버전 이력을 최신순으로 반환합니다."""
    ss = _get_master_spreadsheet(client)
    try:
        ws = ss.worksheet(f"tl_hist_{appid}")
        return list(reversed(ws.get_all_records()))
    except gspread.WorksheetNotFound:
        return []
