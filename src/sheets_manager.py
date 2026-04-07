"""
Google Sheets 연동 모듈
─────────────────────────────────────────────────────
구조:
  [마스터] Steam-Pickaxe-Master  (스프레드시트 1개)
    └ 시트: 게임목록  ← 적재 중인 게임 목록 + 진행 상태

  [게임별] {게임명}_{appid}  (게임 당 스프레드시트 1개)
    ├ 시트: reviews   ← 리뷰 원본 전체 적재
    └ 시트: timeline  ← 타임라인 이벤트 데이터

이 모듈은 steam-review-bot에서도 import하여 사용할 수 있습니다.
"""

import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime, timezone
from typing import Optional

from .config import get_google_credentials, GDRIVE_FOLDER_ID

# ─────────────────────────────────────────────
#  상수
# ─────────────────────────────────────────────
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

MASTER_SHEET_NAME = "Steam-Pickaxe-Master"

# 마스터 시트 컬럼 (게임 목록)
MASTER_COLUMNS = [
    "appid",             # Steam App ID
    "name",              # 게임명 (한국어/원제)
    "name_en",           # 게임명 (영어)
    "release_date",      # 출시일 (YYYY-MM-DD)
    "last_cursor",       # 마지막 수집 cursor (*이면 처음)
    "last_pickaxe_run",  # 마지막 스팀곡괭이 실행 시각 (ISO)
    "total_archived",    # 적재된 총 리뷰 수
    "spreadsheet_id",    # 게임별 스프레드시트 ID
    "status",            # active / paused
]

# 리뷰 아카이브 컬럼 — steam-review-bot과 공유하는 스키마
REVIEW_COLUMNS = [
    "review_id",                    # Steam 리뷰 고유 ID (recommendationid)
    "steamid",                      # 작성자 Steam ID
    "language",                     # 리뷰 작성 언어 (Steam 언어코드)
    "voted_up",                     # 긍정 여부 (TRUE / FALSE)
    "votes_up",                     # 도움됨 투표 수
    "votes_funny",                  # 재밌음 투표 수
    "weighted_vote_score",          # Steam 가중치 점수 (0~1)
    "review",                       # 리뷰 전문 (잘리지 않은 원본)
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
    "event_id",         # 이벤트 고유 ID (예: evt_001)
    "name",             # 이벤트명
    "date",             # 이벤트 발생일 (YYYY-MM-DD)
    "period_end",       # 이 이벤트 영향 기간 종료일
    "type",             # launch / update / crisis / controversy / recovery
    "type_label",       # 한글 표시명
    "sentiment_pct",    # 긍정 비율 (%)
    "review_count",     # 해당 기간 리뷰 수
    "description",      # 이벤트 설명
    "key_issues",       # 주요 이슈 (파이프 | 구분)
    "top_langs",        # TOP 언어 (파이프 | 구분)
    "kr_summary",       # 한국어 유저 반응 요약
    "color",            # 카드 색상 코드
    "user_edited",      # 유저가 수정한 이벤트 여부 (TRUE/FALSE)
    "created_at",       # 최초 생성 시각 (ISO)
    "updated_at",       # 최근 수정 시각 (ISO)
]


# ─────────────────────────────────────────────
#  클라이언트 생성
# ─────────────────────────────────────────────
def get_client() -> gspread.Client:
    """Google Sheets 인증 클라이언트를 반환합니다."""
    creds_dict = get_google_credentials()
    creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
    return gspread.authorize(creds)


# ─────────────────────────────────────────────
#  마스터 시트 관리
# ─────────────────────────────────────────────
def get_or_create_master_sheet(client: gspread.Client) -> gspread.Spreadsheet:
    """마스터 시트를 가져오거나 없으면 생성합니다."""
    try:
        return client.open(MASTER_SHEET_NAME)
    except gspread.SpreadsheetNotFound:
        ss = client.create(MASTER_SHEET_NAME)
        if GDRIVE_FOLDER_ID:
            client.move_spreadsheet(ss.id, GDRIVE_FOLDER_ID)
        ws = ss.sheet1
        ws.update_title("게임목록")
        ws.append_row(MASTER_COLUMNS)
        return ss


def get_all_tracked_games(client: gspread.Client) -> list[dict]:
    """마스터 시트에서 모든 게임 목록을 반환합니다."""
    ss = get_or_create_master_sheet(client)
    return ss.worksheet("게임목록").get_all_records()


def get_game_info(client: gspread.Client, appid: int) -> Optional[dict]:
    """마스터 시트에서 특정 게임 정보를 조회합니다."""
    games = get_all_tracked_games(client)
    for g in games:
        if str(g.get("appid")) == str(appid):
            return g
    return None


def register_game(
    client: gspread.Client,
    appid: int,
    name: str,
    name_en: str,
    release_date: str,
) -> str:
    """
    새 게임을 마스터 시트에 등록하고 전용 스프레드시트를 생성합니다.

    Returns:
        생성된 게임 스프레드시트 ID
    """
    ss_name = f"[리뷰] {name}_{appid}"
    game_ss = client.create(ss_name)

    if GDRIVE_FOLDER_ID:
        client.move_spreadsheet(game_ss.id, GDRIVE_FOLDER_ID)

    # reviews 시트 초기화
    review_ws = game_ss.sheet1
    review_ws.update_title("reviews")
    review_ws.append_row(REVIEW_COLUMNS)
    review_ws.freeze(rows=1)

    # timeline 시트 초기화
    timeline_ws = game_ss.add_worksheet("timeline", rows=500, cols=len(TIMELINE_COLUMNS))
    timeline_ws.append_row(TIMELINE_COLUMNS)
    timeline_ws.freeze(rows=1)

    # 마스터 시트에 게임 등록
    master_ss = get_or_create_master_sheet(client)
    master_ws = master_ss.worksheet("게임목록")
    master_ws.append_row([
        str(appid),
        name,
        name_en,
        release_date,
        "*",            # last_cursor: 처음부터 수집
        "",             # last_pickaxe_run
        0,              # total_archived
        game_ss.id,
        "active",
    ])

    return game_ss.id


def update_master_after_collect(
    client: gspread.Client,
    appid: int,
    new_cursor: str,
    added_count: int,
) -> None:
    """리뷰 수집 완료 후 마스터 시트의 cursor와 통계를 업데이트합니다."""
    master_ss = get_or_create_master_sheet(client)
    master_ws = master_ss.worksheet("게임목록")
    records = master_ws.get_all_records()

    for i, row in enumerate(records, start=2):  # 헤더가 1행이므로 2행부터
        if str(row.get("appid")) == str(appid):
            new_total = int(row.get("total_archived", 0)) + added_count
            now_iso = datetime.now(timezone.utc).isoformat()
            # E=last_cursor, F=last_pickaxe_run, G=total_archived
            master_ws.update(f"E{i}:G{i}", [[new_cursor, now_iso, new_total]])
            break


# ─────────────────────────────────────────────
#  리뷰 적재 & 조회
# ─────────────────────────────────────────────
def _get_game_spreadsheet(client: gspread.Client, game_info: dict) -> gspread.Spreadsheet:
    return client.open_by_key(game_info["spreadsheet_id"])


def save_reviews(
    client: gspread.Client,
    appid: int,
    reviews: list[dict],
    new_cursor: str,
) -> int:
    """
    새 리뷰를 Google Sheets에 적재합니다. 이미 있는 review_id는 건너뜁니다.

    Args:
        client: gspread 클라이언트
        appid: Steam App ID
        reviews: Steam API에서 받은 리뷰 원본 리스트
        new_cursor: 이번 수집의 마지막 cursor

    Returns:
        실제로 새로 적재된 리뷰 수
    """
    game_info = get_game_info(client, appid)
    if not game_info:
        raise ValueError(
            f"appid {appid}가 마스터 시트에 없습니다. register_game()을 먼저 호출하세요."
        )

    ss = _get_game_spreadsheet(client, game_info)
    review_ws = ss.worksheet("reviews")

    # 기존 review_id 조회 (중복 방지)
    existing_ids: set[str] = set()
    existing_rows = review_ws.col_values(1)[1:]  # 헤더 제외, review_id 컬럼
    existing_ids.update(r for r in existing_rows if r)

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
            rev.get("review", ""),                          # 전문 저장 (잘리지 않음)
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
        # Google Sheets API 한 번 호출로 일괄 적재 (효율적)
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

    steam-review-bot에서 이 함수를 import하면,
    Steam API를 다시 호출하지 않고 아카이브된 데이터를 재활용할 수 있습니다.

    Args:
        client: gspread 클라이언트
        appid: Steam App ID
        since_ts: 이 Unix timestamp 이후 작성된 리뷰만 반환 (0이면 전체)
        language: 특정 언어 코드로 필터링 (None이면 전체)
        max_rows: 최대 반환 행 수 (0이면 전체)

    Returns:
        REVIEW_COLUMNS 스키마의 dict 리스트
    """
    game_info = get_game_info(client, appid)
    if not game_info or not game_info.get("spreadsheet_id"):
        return []

    ss = _get_game_spreadsheet(client, game_info)
    review_ws = ss.worksheet("reviews")
    records = review_ws.get_all_records()

    if since_ts:
        records = [
            r for r in records
            if int(r.get("timestamp_created") or 0) > since_ts
        ]
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
    game_info = get_game_info(client, appid)
    if not game_info or not game_info.get("spreadsheet_id"):
        return []
    ss = _get_game_spreadsheet(client, game_info)
    ws = ss.worksheet("timeline")
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
    game_info = get_game_info(client, appid)
    if not game_info:
        raise ValueError(f"appid {appid}가 마스터 시트에 없습니다.")

    ss = _get_game_spreadsheet(client, game_info)
    ws = ss.worksheet("timeline")
    now_iso = datetime.now(timezone.utc).isoformat()

    if overwrite:
        ws.clear()
        ws.append_row(TIMELINE_COLUMNS)
        rows = []
        for e in events:
            rows.append([
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
                e.get("created_at", now_iso),
                now_iso,
            ])
        if rows:
            ws.append_rows(rows, value_input_option="RAW")
    else:
        # upsert: event_id가 있으면 해당 행 업데이트, 없으면 추가
        existing = ws.get_all_records()
        existing_ids = {r["event_id"]: i + 2 for i, r in enumerate(existing)}  # 행 번호 (헤더=1행)

        for e in events:
            eid = e.get("event_id", "")
            row_data = [
                eid,
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
                e.get("created_at", now_iso),
                now_iso,
            ]
            if eid and eid in existing_ids:
                row_num = existing_ids[eid]
                ws.update(f"A{row_num}:P{row_num}", [row_data])
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
    특정 이벤트의 단일 필드를 업데이트합니다. (유저 수정 기능용)

    Returns:
        업데이트 성공 여부
    """
    game_info = get_game_info(client, appid)
    if not game_info:
        return False

    ss = _get_game_spreadsheet(client, game_info)
    ws = ss.worksheet("timeline")
    records = ws.get_all_records()

    if field not in TIMELINE_COLUMNS:
        raise ValueError(f"알 수 없는 필드: {field}")

    col_idx = TIMELINE_COLUMNS.index(field) + 1  # 1-indexed

    for i, row in enumerate(records, start=2):
        if row.get("event_id") == event_id:
            ws.update_cell(i, col_idx, value)
            # updated_at도 함께 갱신
            updated_col = TIMELINE_COLUMNS.index("updated_at") + 1
            ws.update_cell(i, updated_col, datetime.now(timezone.utc).isoformat())
            # user_edited 플래그 설정
            edited_col = TIMELINE_COLUMNS.index("user_edited") + 1
            ws.update_cell(i, edited_col, "True")
            return True

    return False
