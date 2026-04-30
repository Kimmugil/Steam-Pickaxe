"""
평가 급변 감지 + AI 분석 실행 진입점 (GitHub Actions: detect-shifts.yml)

[실행 흐름]
  1. 모든 active 게임 순회
  2. RAW 리뷰 전체 로드 → 급변 구간 감지 (API 비용 없음)
  3. 신규 급변 구간별 Gemini 분석 (구간당 ~$0.0005)
  4. 타임라인에 sentiment_shift 이벤트 저장
  5. last_shift_detection_date 업데이트

[환경변수]
  TARGET_APPID — 설정 시 해당 게임만 처리 (미설정 = 전체)
  DRY_RUN      — "true" 시 시트 저장 없이 미리보기
"""

import sys, os, json, time
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timezone

from sheets.master_sheet import get_spreadsheet, get_all_games, update_game, ensure_games_headers
from sheets.game_sheet   import (
    open_game_sheet, get_timeline, append_timeline_row,
    get_rate_history,
)
from sheets.raw_reviews  import open_raw_spreadsheet, get_all_reviews, get_reviews_in_range
from analyzers.shift_detector import detect_shifts
from analyzers.shift_analyzer import analyze_shift

TARGET_APPID = os.environ.get("TARGET_APPID", "").strip()
DRY_RUN      = os.environ.get("DRY_RUN", "").strip().lower() in ("1", "true", "yes")


def run():
    if DRY_RUN:
        print("[DRY-RUN] 실제 저장을 수행하지 않습니다.\n")

    ss = get_spreadsheet()
    ensure_games_headers(ss)
    games = get_all_games(ss)

    total_new = 0

    for game in games:
        if game.get("status") != "active":
            continue
        appid = str(game.get("appid", ""))
        if TARGET_APPID and appid != TARGET_APPID:
            continue

        name          = game.get("name", appid)
        game_sheet_id = game.get("game_sheet_id", "")
        if not game_sheet_id:
            continue

        print(f"\n{'='*50}\n{name} ({appid})")

        try:
            new_count = _process_game(ss, game, appid, name, game_sheet_id)
            total_new += new_count
        except Exception as e:
            import traceback
            print(f"[ERROR] {name} ({appid}): {e}")
            print(traceback.format_exc())

    print(f"\n전체 완료: 신규 급변 이벤트 {total_new}건 {'(예정)' if DRY_RUN else '저장'}")


def _process_game(ss, game: dict, appid: str, name: str, game_sheet_id: str) -> int:
    game_ss = open_game_sheet(game_sheet_id)
    raw_ss  = open_raw_spreadsheet(game_sheet_id)

    # ── 전체 리뷰 로드 ─────────────────────────────────────────────────────────
    print("  RAW 리뷰 로드 중...")
    all_reviews = get_all_reviews(raw_ss)
    if not all_reviews:
        print("  [SKIP] 리뷰 없음")
        return 0
    print(f"  리뷰 {len(all_reviews)}건 로드")

    # ── 기존 급변 이벤트 수집 (중복 방지) ────────────────────────────────────
    timeline = get_timeline(game_ss)
    existing_shift_dates = {
        str(r.get("date", ""))
        for r in timeline
        if r.get("event_type") == "sentiment_shift"
    }

    # ── 공식 긍정율 이력 로드 ─────────────────────────────────────────────────
    rate_history = get_rate_history(game_ss)

    # ── 감지 실행 ─────────────────────────────────────────────────────────────
    new_shifts = detect_shifts(all_reviews, existing_shift_dates=existing_shift_dates)

    if not new_shifts:
        print("  신규 급변 없음")
        _update_detection_date(ss, appid)
        return 0

    print(f"  신규 급변 {len(new_shifts)}건 감지 → AI 분석 시작")

    # ── 급변별 AI 분석 + 저장 ─────────────────────────────────────────────────
    saved = 0
    for shift in new_shifts:
        direction_label = "📉 급락" if shift["direction"] == "decline" else "📈 회복"
        print(f"    [{shift['date']} ~ {shift['date_end']}] {direction_label} "
              f"{shift['sentiment_before']}% → {shift['sentiment_rate']}% "
              f"({shift['sentiment_delta']:+.1f}pp, {shift['review_count']}건, "
              f"신뢰도={shift['confidence']})")

        # 해당 구간 리뷰 추출
        shift_reviews = _get_shift_reviews(all_reviews, shift["date"], shift["date_end"])

        # AI 분석
        analyzed = analyze_shift(name, shift, shift_reviews, timeline, rate_history)
        time.sleep(2)  # Gemini 레이트 리밋

        if DRY_RUN:
            print(f"    [DRY-RUN] 저장 생략 — {analyzed.get('ai_reaction_summary', '')[:60]}...")
            saved += 1
            continue

        try:
            append_timeline_row(game_ss, analyzed)
            saved += 1
            time.sleep(1.5)  # Sheets 레이트 리밋
        except Exception as e:
            print(f"    [ERROR] 저장 실패: {e}")

    if not DRY_RUN:
        _update_detection_date(ss, appid)
        _update_latest_shift(ss, appid, timeline)

    print(f"  완료: {saved}건 {'(예정)' if DRY_RUN else '저장'}")
    return saved


def _get_shift_reviews(
    all_reviews: list[dict], date_start: str, date_end: str
) -> list[dict]:
    """급변 구간 날짜 범위의 리뷰 필터링."""
    from datetime import timezone as _tz
    try:
        start_ts = int(datetime.strptime(date_start, "%Y-%m-%d")
                       .replace(tzinfo=timezone.utc).timestamp())
        end_ts   = int(datetime.strptime(date_end, "%Y-%m-%d")
                       .replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
                       .timestamp())
    except Exception:
        return []

    return [
        r for r in all_reviews
        if start_ts <= int(r.get("timestamp_created", 0) or 0) <= end_ts
    ]


def _update_detection_date(ss, appid: str):
    today = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
    try:
        update_game(ss, appid, {"last_shift_detection_date": today})
    except Exception as e:
        print(f"  [WARN] last_shift_detection_date 업데이트 실패: {e}")


def _update_latest_shift(ss, appid: str, timeline: list):
    """타임라인 전체에서 가장 최근 sentiment_shift 이벤트를 master sheet에 요약 저장."""
    shift_events = [r for r in timeline if r.get("event_type") == "sentiment_shift"]
    if not shift_events:
        return
    latest = max(shift_events, key=lambda r: r.get("date", ""))
    try:
        update_game(ss, appid, {
            "latest_shift_date":      str(latest.get("date", "")),
            "latest_shift_direction": str(latest.get("direction", "")),
            "latest_shift_delta":     str(latest.get("sentiment_delta", "")),
        })
    except Exception as e:
        print(f"  [WARN] latest_shift 업데이트 실패: {e}")


if __name__ == "__main__":
    run()
