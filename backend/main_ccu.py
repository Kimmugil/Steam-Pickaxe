"""
CCU 수집 진입점 (GitHub Actions: ccu.yml — 1시간 주기)
active 상태 게임의 현재 CCU를 수집하여 개별 게임 시트의 ccu 탭에 적재.
마스터 시트에는 쓰지 않는다 (config / games / ui_text 탭만 사용).
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from sheets.master_sheet import get_spreadsheet, get_all_games
from sheets.game_sheet import open_game_sheet, append_ccu as gs_append_ccu
from collectors.steam_ccu import fetch_current_ccu, now_utc_iso
from collectors.steam_news import fetch_sale_info


def run():
    ss = get_spreadsheet()
    games = get_all_games(ss)

    for game in games:
        if game.get("status") != "active":
            continue

        appid = str(game.get("appid", ""))
        name = game.get("name", appid)
        game_sheet_id = game.get("game_sheet_id", "")

        if not game_sheet_id:
            print(f"[CCU] {name} ({appid}): game_sheet_id 없음, 건너뜀")
            continue

        ccu = fetch_current_ccu(appid)
        if ccu is None:
            print(f"[CCU] {name} ({appid}): 수집 실패")
            continue

        sale_info = fetch_sale_info(appid)
        is_sale = sale_info.get("is_sale", False)

        timestamp = now_utc_iso()
        game_ss = open_game_sheet(game_sheet_id)
        gs_append_ccu(game_ss, timestamp, ccu, is_sale=is_sale)
        print(f"[CCU] {name} ({appid}): {ccu:,}명 {'(할인 중)' if is_sale else ''}")

    print("CCU 수집 완료")


if __name__ == "__main__":
    run()
