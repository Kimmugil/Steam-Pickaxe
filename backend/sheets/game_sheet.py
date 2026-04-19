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
    "title_kr",   # AI 생성 한국어 제목 (신규 — 기존 시트는 자동 마이그레이션)
    "content",    # 이벤트 본문 텍스트 (HTML 제거 후, AI 요약 입력용)
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
        ws = ss.worksheet("timeline")
        # 신규 컬럼 마이그레이션: 헤더 행에 없는 컬럼을 오른쪽에 추가
        current_headers = ws.row_values(1)
        if len(current_headers) < len(TIMELINE_HEADERS):
            for i in range(len(current_headers), len(TIMELINE_HEADERS)):
                ws.update_cell(1, i + 1, TIMELINE_HEADERS[i])
        return ws
    except gspread.WorksheetNotFound:
        ws = ss.add_worksheet(title="timeline", rows=1000, cols=len(TIMELINE_HEADERS))
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


def build_scope_row_map(timeline_rows: list[dict]) -> dict[tuple, int]:
    """
    이미 조회된 timeline_rows로 (event_id, language_scope) → 시트 행 번호(2-based) 맵 생성.
    update_timeline_row에 전달하면 get_all_records() 재호출을 생략합니다.
    """
    return {
        (str(r.get("event_id", "")), str(r.get("language_scope", ""))): i + 2
        for i, r in enumerate(timeline_rows)
    }


def build_event_row_map(timeline_rows: list[dict]) -> dict[str, list[int]]:
    """
    이미 조회된 timeline_rows로 event_id → [행 번호, ...] 맵 생성.
    update_timeline_event_field에 전달하면 get_all_records() 재호출을 생략합니다.
    """
    result: dict[str, list[int]] = {}
    for i, r in enumerate(timeline_rows):
        eid = str(r.get("event_id", ""))
        result.setdefault(eid, []).append(i + 2)
    return result


@_retry_on_quota
def update_timeline_row(
    ss: gspread.Spreadsheet,
    event_id: str,
    language_scope: str,
    updates: dict,
    row_map: dict[tuple, int] | None = None,
):
    """
    타임라인 행 업데이트.
    row_map 제공 시 get_all_records() 재호출 없이 직접 행 번호로 접근하고,
    모든 셀 변경을 batch_update 1회로 처리합니다 (API 쿼터 최소화).
    """
    ws = get_or_create_timeline_tab(ss)
    headers = ws.row_values(1)

    if row_map is not None:
        row_idx = row_map.get((str(event_id), str(language_scope)))
        if row_idx is None:
            return
    else:
        records = ws.get_all_records()
        row_idx = next(
            (i + 2 for i, rec in enumerate(records)
             if str(rec.get("event_id")) == str(event_id)
             and str(rec.get("language_scope")) == language_scope),
            None,
        )
        if row_idx is None:
            return

    # 변경할 셀 목록을 한 번에 batch_update (write 요청 1회)
    import gspread.utils as _gu
    cell_updates = [
        {"range": _gu.rowcol_to_a1(row_idx, headers.index(key) + 1), "values": [[val]]}
        for key, val in updates.items()
        if key in headers
    ]
    if cell_updates:
        ws.batch_update(cell_updates)


@_retry_on_quota
def update_timeline_event_field(
    ss: gspread.Spreadsheet,
    event_id: str,
    key: str,
    value: str,
    event_row_map: dict[str, list[int]] | None = None,
):
    """
    특정 event_id의 모든 language_scope 행에서 단일 컬럼 값을 업데이트.
    title_kr 처럼 스코프 무관하게 동일한 값을 가지는 필드 백필에 사용.
    event_row_map 제공 시 get_all_records() 재호출을 생략합니다.
    """
    ws = get_or_create_timeline_tab(ss)
    headers = ws.row_values(1)
    if key not in headers:
        print(f"[update_field] 헤더에 '{key}' 없음 — 마이그레이션이 필요합니다.")
        return
    col_idx = headers.index(key) + 1

    if event_row_map is not None:
        rows_to_update = event_row_map.get(str(event_id), [])
    else:
        records = ws.get_all_records()
        rows_to_update = [
            i + 2 for i, r in enumerate(records)
            if str(r.get("event_id")) == str(event_id)
        ]

    import gspread.utils as _gu
    cell_updates = [
        {"range": _gu.rowcol_to_a1(row_idx, col_idx), "values": [[value]]}
        for row_idx in rows_to_update
    ]
    if cell_updates:
        ws.batch_update(cell_updates)


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


@_retry_on_quota
def cleanup_stale_launch_buckets(ss: gspread.Spreadsheet):
    """
    공식 이벤트가 존재할 때 자동 생성된 모든 런칭 버킷 행을 제거합니다.
    - 과거 랜덤 UUID로 생성된 구형 launch 행
    - build_buckets가 자동 삽입한 고정 ID(launch_bucket) 행
    모두 공식 이벤트(official/manual)가 1건 이상 존재할 때만 호출해야 합니다.
    """
    ws = get_or_create_timeline_tab(ss)
    records = ws.get_all_records()
    rows_to_delete = [
        i + 2
        for i, r in enumerate(records)
        if r.get("event_type") == "launch"
    ]
    if rows_to_delete:
        print(f"  [cleanup] 런칭 버킷 {len(rows_to_delete)}행 삭제")
        for row_idx in sorted(rows_to_delete, reverse=True):
            ws.delete_rows(row_idx)


def deduplicate_timeline(ss: gspread.Spreadsheet) -> int:
    """
    타임라인에서 동일한 이벤트가 여러 번 수집된 중복 행을 제거합니다.

    중복 판정 기준 (우선순위 순):
      1. Steam URL에서 추출한 GID (.../view/{gid})
      2. 제목 + 날짜 조합

    language_scope="all" 행을 기준으로 첫 번째로 수집된 event_id(최소 행 번호)를 남기고,
    나머지 중복 event_id에 속한 모든 행(all/koreana/english 등 포함)을 삭제합니다.

    Returns:
        int: 제거된 중복 이벤트 수 (고유 event_id 기준)
    """
    import re as _re

    def _gid(url: str) -> str | None:
        m = _re.search(r"/view/(\d+)", url or "")
        return m.group(1) if m else None

    ws = get_or_create_timeline_tab(ss)
    records = ws.get_all_records()

    # language_scope="all" 행만 기준으로 중복 식별
    # seen_keys: canon_key → 최초 수집된 event_id
    seen_keys: dict[str, str] = {}
    duplicate_event_ids: set[str] = set()

    for r in records:
        if str(r.get("language_scope", "")) != "all":
            continue

        event_id = str(r.get("event_id", "")).strip()
        if not event_id:
            continue

        url   = str(r.get("url",   "")).strip()
        title = str(r.get("title", "")).strip()
        date  = str(r.get("date",  "")).strip()

        gid = _gid(url)
        if gid:
            canon_key = f"gid:{gid}"
        elif title and date:
            canon_key = f"td:{title}|{date}"
        else:
            continue  # 식별 키 없음 → 판정 불가, 건너뜀

        if canon_key in seen_keys:
            if seen_keys[canon_key] != event_id:
                # 동일 이벤트의 다른 event_id → 중복
                duplicate_event_ids.add(event_id)
        else:
            seen_keys[canon_key] = event_id

    if not duplicate_event_ids:
        return 0

    # 중복 event_id에 속한 모든 행(언어 스코프 무관) 삭제
    rows_to_delete = [
        i + 2
        for i, r in enumerate(records)
        if str(r.get("event_id", "")) in duplicate_event_ids
    ]

    total_rows = len(rows_to_delete)
    dup_count  = len(duplicate_event_ids)
    print(f"  [dedup] 중복 이벤트 {dup_count}건 ({total_rows}행) 삭제")

    for row_idx in sorted(rows_to_delete, reverse=True):
        ws.delete_rows(row_idx)
        time.sleep(0.15)  # Sheets API 레이트 리밋 방지

    return dup_count


# ──────────────────────────────────────────────
# ccu 탭 (개별 게임 시트)
# ──────────────────────────────────────────────

CCU_HEADERS = ["timestamp", "ccu_value", "is_sale_period", "is_free_weekend", "is_archived_gap"]

_CELL_LIMIT = 10_000_000
_CCU_TAB_CELLS = 1000 * 5  # 생성할 ccu 탭 셀 수


def _shrink_large_tabs_if_needed(ss: gspread.Spreadsheet) -> None:
    """
    스프레드시트 총 셀이 10M 한도에 근접하면, 실제 데이터 행보다 과도하게 큰
    탭(reviews_YYYY 등)을 실제 데이터 크기에 맞게 축소한다.
    ccu 탭 생성 전에 호출해 한도 초과를 방지한다.
    """
    worksheets = ss.worksheets()
    total_cells = sum(ws.row_count * ws.col_count for ws in worksheets)

    if total_cells + _CCU_TAB_CELLS <= _CELL_LIMIT:
        return  # 여유 있음 — 축소 불필요

    print(f"[shrink] 총 셀 {total_cells:,} / 한도 {_CELL_LIMIT:,} → 대형 탭 축소 시작")

    requests = []
    for ws in worksheets:
        if ws.row_count * ws.col_count <= 100_000:
            continue  # 소형 탭은 건드리지 않음

        # A열 값만 읽어 실제 데이터 마지막 행 파악 (빈 행은 반환 안 됨)
        try:
            col_a = ws.col_values(1)
            data_rows = len(col_a)
        except Exception:
            data_rows = min(ws.row_count, 5000)

        target_rows = max(data_rows + 50, 100)
        if target_rows >= ws.row_count:
            continue  # 이미 충분히 작음

        requests.append({
            "updateSheetProperties": {
                "properties": {
                    "sheetId": ws.id,
                    "gridProperties": {
                        "rowCount": target_rows,
                        "columnCount": ws.col_count,
                    },
                },
                "fields": "gridProperties.rowCount,gridProperties.columnCount",
            }
        })
        print(f"  {ws.title}: {ws.row_count:,}행 → {target_rows:,}행")

    if requests:
        ss.batch_update({"requests": requests})
        print(f"[shrink] {len(requests)}개 탭 축소 완료")


def get_or_create_ccu_tab(ss: gspread.Spreadsheet) -> gspread.Worksheet:
    try:
        return ss.worksheet("ccu")
    except gspread.WorksheetNotFound:
        _shrink_large_tabs_if_needed(ss)
        ws = ss.add_worksheet(title="ccu", rows=1000, cols=len(CCU_HEADERS))
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
