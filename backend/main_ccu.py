"""
CCU 수집 진입점 (GitHub Actions: ccu.yml — 1시간 주기)
active 상태 게임의 현재 CCU를 수집하여 ccu_{appid} 탭에 적재
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from sheets.master_sheet import get_spreadsheet, get_all_games, append_ccu
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
        ccu = fetch_current_ccu(appid)

        if ccu is None:
            print(f"[CCU] {name} ({appid}): 수집 실패")
            continue

        sale_info = fetch_sale_info(appid)
        is_sale = sale_info.get("is_sale", False)
        discount = sale_info.get("discount_percent", 0)

        timestamp = now_utc_iso()
        append_ccu(ss, appid, timestamp, ccu, is_sale=is_sale)
        print(f"[CCU] {name} ({appid}): {ccu:,}명 {'(할인 중)' if is_sale else ''}")

    print("CCU 수집 완료")


if __name__ == "__main__":
    run()
