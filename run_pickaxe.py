"""
스팀곡괭이 실행 진입점
─────────────────────────────────────────────────────
GitHub Actions에서 매일 1회 이 스크립트를 호출합니다.
마스터 시트에 등록된 active 상태 게임의 신규 리뷰를 수집하고,
누적 리뷰가 충분히 쌓이면 Gemini로 타임라인을 재분석합니다.

수동 실행: python run_pickaxe.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from src.sheets_manager import (
    get_client, get_all_tracked_games,
    get_last_cursor, save_reviews,
    load_reviews, save_timeline_events,
)
from src.steam_pickaxe import collect_all_reviews, fetch_steam_news, fetch_game_info
from src.gemini_analyzer import analyze_reviews_to_timeline

# 타임라인 재분석 기준: 이번 수집으로 처음 N건을 넘으면 재분석
REANALYZE_THRESHOLDS = [500, 2000, 10000, 30000, 100000]


def _should_reanalyze(prev_total: int, new_total: int) -> bool:
    """이번 수집이 재분석 기준선을 통과하는지 확인합니다."""
    for threshold in REANALYZE_THRESHOLDS:
        if prev_total < threshold <= new_total:
            return True
    return False


def run():
    print("=" * 55)
    print("  ⛏  스팀곡괭이 시작")
    print("=" * 55)

    client = get_client()
    games  = get_all_tracked_games(client)

    active_games = [g for g in games if g.get("status") == "active"]
    print(f"\n  대상 게임: {len(active_games)}개\n")

    total_saved = 0

    for game in active_games:
        appid       = int(game["appid"])
        name        = game.get("name", str(appid))
        last_cursor = game.get("last_cursor") or "*"
        prev_total  = int(game.get("total_archived") or 0)

        print(f"  🎮 [{name}]  appid={appid}  누적={prev_total:,}건")

        try:
            # ── 증분 리뷰 수집 ──
            reviews, new_cursor = collect_all_reviews(
                appid,
                last_cursor=last_cursor,
                max_pages=500,
            )

            if reviews:
                saved      = save_reviews(client, appid, reviews, new_cursor)
                new_total  = prev_total + saved
                total_saved += saved
                print(f"     ✅ {saved:,}건 신규 적재 (총 {new_total:,}건)")

                # ── 타임라인 재분석 ──
                if _should_reanalyze(prev_total, new_total):
                    print(f"     🤖 재분석 기준 도달 ({new_total:,}건) — Gemini 분석 시작")
                    try:
                        all_reviews = load_reviews(client, appid, max_rows=5000)
                        news        = fetch_steam_news(appid)
                        game_detail = fetch_game_info(appid) or {}

                        events = analyze_reviews_to_timeline(
                            game_name     = name,
                            release_date  = game.get("release_date", ""),
                            total_reviews = game_detail.get("total_reviews", new_total),
                            reviews       = all_reviews,
                            steam_news    = news,
                        )
                        save_timeline_events(client, appid, events, overwrite=True)
                        print(f"     ✅ 타임라인 {len(events)}개 이벤트 저장")
                    except Exception as ge:
                        print(f"     ⚠️  Gemini 재분석 실패 (수집은 성공): {ge}")
                else:
                    print(f"     ℹ️  재분석 기준 미달 — 타임라인 유지")
            else:
                print(f"     ℹ️  신규 리뷰 없음")

        except Exception as e:
            print(f"     ❌ 오류 발생: {e}")
            continue

        print()

    print("=" * 55)
    print(f"  ✅ 완료 — 총 {total_saved:,}건 새로 적재됨")
    print("=" * 55)


if __name__ == "__main__":
    run()
