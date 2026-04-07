"""
스팀곡괭이 실행 진입점
─────────────────────────────────────────────────────
GitHub Actions에서 매일 1회 이 스크립트를 호출합니다.
마스터 시트에 등록된 active 상태 게임의 신규 리뷰를 모두 수집합니다.

수동 실행: python run_pickaxe.py
"""

import sys
import os

# 프로젝트 루트를 Python path에 추가
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from src.sheets_manager import get_client, get_all_tracked_games, get_last_cursor, save_reviews
from src.steam_pickaxe import collect_all_reviews


def run():
    print("=" * 55)
    print("  ⛏  스팀곡괭이 시작")
    print("=" * 55)

    client = get_client()
    games = get_all_tracked_games(client)

    active_games = [g for g in games if g.get("status") == "active"]
    print(f"\n  대상 게임: {len(active_games)}개\n")

    total_saved = 0

    for game in active_games:
        appid = int(game["appid"])
        name  = game.get("name", str(appid))
        last_cursor = game.get("last_cursor") or "*"

        print(f"  🎮 [{name}]  appid={appid}")
        print(f"     cursor: {str(last_cursor)[:30]}...")

        try:
            reviews, new_cursor = collect_all_reviews(
                appid,
                last_cursor=last_cursor,
                max_pages=500,
            )

            if reviews:
                saved = save_reviews(client, appid, reviews, new_cursor)
                total_saved += saved
                print(f"     ✅ {saved:,}건 신규 적재 (API에서 {len(reviews):,}건 수신)\n")
            else:
                print(f"     ℹ️  신규 리뷰 없음\n")

        except Exception as e:
            print(f"     ❌ 오류 발생: {e}\n")
            continue

    print("=" * 55)
    print(f"  ✅ 완료 — 총 {total_saved:,}건 새로 적재됨")
    print("=" * 55)


if __name__ == "__main__":
    run()
