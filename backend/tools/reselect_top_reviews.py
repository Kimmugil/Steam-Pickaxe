"""
기존 월간 분석의 top_reviews를 새 선별 기준으로 재선택합니다.

[처리 대상]
- AI 분석이 완료된 월간 버킷 (language_scope="all", sentiment_rate 숫자값)
- 각 게임의 RAW 리뷰 시트에서 해당 월 리뷰를 직접 읽어 재선별

[선별 기준 (AI 호출 없이 코드로 처리)]
- votes_up 기준 정렬
- 긍정 최대 2건 + 부정 최대 1건, 전체 최대 3건
- 한국어 원문이면 text_kr = text, 그 외 언어는 text_kr = "" (프론트엔드가 원문 표시)

[유지되는 기존 값]
- sentiment_rate, top_keywords, ai_reaction_summary, ai_patch_summary
- 기타 모든 타임라인 필드

실행 방법:
  python tools/reselect_top_reviews.py
  python tools/reselect_top_reviews.py --appid 1234567
  python tools/reselect_top_reviews.py --dry-run
  python tools/reselect_top_reviews.py --appid 1234567 --dry-run
"""
import sys
import os
import json
import time
import argparse
from datetime import datetime, timezone
from calendar import monthrange

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sheets.master_sheet import get_spreadsheet, get_all_games
from sheets.game_sheet import get_or_create_timeline_tab, build_scope_row_map
from sheets.raw_reviews import open_raw_spreadsheet, get_reviews_in_range
import gspread


def _is_positive(r: dict) -> bool:
    v = r.get("voted_up", False)
    return v is True or str(v).upper() == "TRUE"


def _select_top_reviews(reviews: list[dict]) -> list[str]:
    """
    votes_up 기준으로 긍정 최대 2건 + 부정 최대 1건 선별.
    반환: JSON 직렬화 가능한 top_reviews 리스트
    """
    positives = sorted(
        [r for r in reviews if _is_positive(r)],
        key=lambda r: int(r.get("votes_up", 0)),
        reverse=True,
    )
    negatives = sorted(
        [r for r in reviews if not _is_positive(r)],
        key=lambda r: int(r.get("votes_up", 0)),
        reverse=True,
    )
    selected = positives[:2] + negatives[:1]
    result = []
    for r in selected:
        text = str(r.get("review", ""))[:500]
        lang = r.get("language", "")
        result.append({
            "text":     text,
            "text_kr":  text if lang == "koreana" else "",
            "voted_up": _is_positive(r),
            "language": lang,
        })
    return result


def _month_ts_range(date_str: str) -> tuple[int, int]:
    """
    'YYYY-MM-DD' 형식의 날짜에서 해당 월 전체의 start_ts, end_ts 반환 (UTC).
    현재 월이면 end_ts = 지금 시각.
    """
    year  = int(date_str[:4])
    month = int(date_str[5:7])
    _, last_day = monthrange(year, month)

    start_dt = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
    now = datetime.now(tz=timezone.utc)
    current_ym = now.strftime("%Y-%m")
    row_ym = f"{year:04d}-{month:02d}"
    end_dt = now if row_ym == current_ym else datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)

    return int(start_dt.timestamp()), int(end_dt.timestamp())


def process_game(game: dict, dry_run: bool) -> int:
    """단일 게임의 top_reviews 재선별. 반환: 업데이트된 버킷 수."""
    appid         = str(game.get("appid", ""))
    name          = game.get("name", appid)
    game_sheet_id = game.get("game_sheet_id", "")

    if not game_sheet_id:
        print(f"  [SKIP] game_sheet_id 없음")
        return 0

    try:
        from sheets.game_sheet import open_game_sheet
        game_ss = open_game_sheet(game_sheet_id)
        raw_ss  = open_raw_spreadsheet(game_sheet_id)
    except Exception as e:
        print(f"  [ERROR] 시트 열기 실패: {e}")
        return 0

    # ── 타임라인 조회 ────────────────────────────────────────────────────
    try:
        ws = get_or_create_timeline_tab(game_ss)
        timeline_rows = ws.get_all_records()
    except Exception as e:
        print(f"  [ERROR] 타임라인 조회 실패: {e}")
        return 0

    # 처리 대상: scope=all, monthly_summary, sentiment_rate가 숫자값인 완료 행
    target_rows = [
        r for r in timeline_rows
        if r.get("event_type") == "monthly_summary"
        and r.get("language_scope") == "all"
        and str(r.get("sentiment_rate", "")).strip() not in ("", "sparse")
    ]

    if not target_rows:
        print(f"  [SKIP] 분석 완료된 월간 버킷 없음")
        return 0

    print(f"  처리 대상: {len(target_rows)}개 월간 버킷")

    headers   = ws.row_values(1)
    scope_map = build_scope_row_map(timeline_rows)

    if "top_reviews" not in headers:
        print(f"  [ERROR] top_reviews 컬럼 없음")
        return 0
    top_reviews_col = headers.index("top_reviews") + 1  # 1-based

    updated = 0
    for row in target_rows:
        date_str = str(row.get("date", "")).strip()
        event_id = str(row.get("event_id", "")).strip()
        if not date_str or len(date_str) < 7:
            continue

        try:
            start_ts, end_ts = _month_ts_range(date_str)
            bucket_year = datetime.utcfromtimestamp(max(start_ts, 1)).year
        except Exception:
            continue

        # 해당 월 RAW 리뷰 조회
        try:
            month_reviews = get_reviews_in_range(raw_ss, start_ts, end_ts, [bucket_year])
        except Exception as e:
            print(f"    [{date_str[:7]}] 리뷰 조회 실패: {e}")
            continue

        if not month_reviews:
            print(f"    [{date_str[:7]}] 리뷰 0건 — 건너뜀")
            continue

        new_top = _select_top_reviews(month_reviews)
        new_top_json = json.dumps(new_top, ensure_ascii=False)

        old_top_json = str(row.get("top_reviews", "[]"))
        if new_top_json == old_top_json:
            print(f"    [{date_str[:7]}] 변경 없음")
            continue

        print(f"    [{date_str[:7]}] {len(month_reviews)}건 → 긍정 {sum(1 for r in new_top if r['voted_up'])}건 / 부정 {sum(1 for r in new_top if not r['voted_up'])}건 선별")
        if dry_run:
            print(f"    [DRY-RUN] 저장 생략")
            updated += 1
            continue

        # 해당 행 번호 찾기
        row_idx = scope_map.get((event_id, "all"))
        if not row_idx:
            print(f"    [{date_str[:7]}] 행 번호 못 찾음 — 건너뜀")
            continue

        try:
            import gspread.utils as _gu
            ws.batch_update([{
                "range":  _gu.rowcol_to_a1(row_idx, top_reviews_col),
                "values": [[new_top_json]],
            }])
            updated += 1
            time.sleep(1.5)  # Sheets API 레이트 리밋 방지
        except gspread.exceptions.APIError as e:
            if "429" in str(e):
                print(f"    [429] 쿼터 초과 — 30초 대기 후 재시도")
                time.sleep(30)
                try:
                    ws.batch_update([{
                        "range":  _gu.rowcol_to_a1(row_idx, top_reviews_col),
                        "values": [[new_top_json]],
                    }])
                    updated += 1
                except Exception as e2:
                    print(f"    [ERROR] 재시도 실패: {e2}")
            else:
                print(f"    [ERROR] 저장 실패: {e}")

    return updated


def main():
    parser = argparse.ArgumentParser(description="월간 버킷 top_reviews 재선별")
    parser.add_argument("--appid",   default="", help="특정 게임 AppID만 처리")
    parser.add_argument("--dry-run", action="store_true", help="저장 없이 미리보기")
    args = parser.parse_args()

    if args.dry_run:
        print("[DRY-RUN 모드] 실제 저장을 수행하지 않습니다.\n")

    ss = get_spreadsheet()
    games = get_all_games(ss)

    total_updated = 0
    for game in games:
        if game.get("status") != "active":
            continue
        appid = str(game.get("appid", ""))
        if args.appid and appid != args.appid:
            continue

        name = game.get("name", appid)
        print(f"\n{'='*50}\n{name} ({appid})")
        updated = process_game(game, dry_run=args.dry_run)
        total_updated += updated
        print(f"  완료: {updated}개 버킷 {'(예정)' if args.dry_run else '업데이트'}")

    print(f"\n전체 완료: {total_updated}개 버킷 {'(예정)' if args.dry_run else '업데이트'}")


if __name__ == "__main__":
    main()
