"""
타임라인 중복 이벤트 일괄 정리 도구
모든 active 게임의 timeline 탭에서 중복 이벤트(event_id 기준)를 일괄 제거합니다.

deduplicate_timeline() 은 game_sheet.py 의 기존 함수를 재사용합니다.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sheets.master_sheet import get_spreadsheet, get_all_games
from sheets.game_sheet import open_game_sheet, deduplicate_timeline


def run():
    ss    = get_spreadsheet()
    games = get_all_games(ss)

    total_removed = 0
    processed     = 0
    skipped       = 0

    for game in games:
        if game.get("status") != "active":
            continue
        game_sheet_id = game.get("game_sheet_id", "")
        if not game_sheet_id:
            continue

        appid = str(game.get("appid", ""))
        name  = game.get("name", appid)

        try:
            game_ss       = open_game_sheet(game_sheet_id)
            removed, _    = deduplicate_timeline(game_ss)
            if removed:
                print(f"[{name}] 중복 {removed}건 제거")
                total_removed += removed
            else:
                print(f"[{name}] 중복 없음")
            processed += 1
        except Exception as e:
            print(f"[{name}] 오류: {e}")
            skipped += 1
            continue

    print(f"\n── 완료: {processed}개 게임 검사, {total_removed}건 중복 제거, {skipped}개 오류 ──")


if __name__ == "__main__":
    run()
