"""
일일 수집 진입점 (GitHub Actions: collect.yml)
- active/collecting 상태인 모든 게임의 리뷰 + 뉴스 수집
- collecting 완료 시 active로 상태 전환
- Sheet_Pool을 통해 사전 할당된 시트에 RAW 리뷰 저장
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from sheets.master_sheet import get_spreadsheet, get_all_games, update_game
from sheets.raw_reviews import open_raw_spreadsheet, append_reviews
from sheets.sheet_pool import allocate_sheet, get_pool_status
from collectors.steam_reviews import collect_reviews_batch, get_total_review_count
from collectors.steam_news import fetch_news, classify_news, parse_news_item
from collectors.steam_meta import fetch_app_details, parse_game_meta
from collectors.steamspy import fetch_steamspy_data, parse_steamspy_meta
from collectors.steam_ccu import fetch_peak_ccu
from analyzers.bucketer import build_buckets
import json
from datetime import datetime, timezone
from config import MASTER_SPREADSHEET_ID

MAX_PAGES_PER_RUN = 450  # 약 36,000건 / 6시간 GitHub Actions 제한 대응


def run():
    ss = get_spreadsheet()
    games = get_all_games(ss)

    # 풀 현황 로깅
    pool_info = get_pool_status(ss)
    print(f"[POOL 현황] 전체={pool_info['total']} / 사용중={pool_info['used']} / 여유={pool_info['empty']}")

    for game in games:
        status = game.get("status", "")
        appid = str(game.get("appid", ""))

        # error_pool_empty 상태도 재시도 대상에서 제외
        # (관리자가 풀을 보충하고 retry-pool API로 상태를 collecting으로 되돌린 후에만 재시도)
        if status not in ("active", "collecting"):
            continue

        print(f"\n{'='*50}")
        print(f"처리 중: {game.get('name')} (AppID: {appid}, status: {status})")

        # 1. 메타데이터 갱신
        app_data = fetch_app_details(appid)
        if app_data:
            meta = parse_game_meta(appid, app_data)
            spy_data = fetch_steamspy_data(appid)
            spy_meta = parse_steamspy_meta(spy_data)
            peak_ccu = fetch_peak_ccu(appid)
            update_game(ss, appid, {
                "name": meta["name"],
                "is_free": meta["is_free"],
                "metacritic_score": meta["metacritic_score"],
                "owners_estimate": spy_meta["owners_estimate"],
                "avg_playtime": spy_meta["avg_playtime"],
                "median_playtime": spy_meta["median_playtime"],
                "active_players_2weeks": spy_meta["active_players_2weeks"],
                "peak_ccu": peak_ccu,
            })
            print("메타데이터 갱신 완료")

        # 2. 뉴스/패치노트 수집 (active 상태에서만)
        if status == "active":
            _collect_news(ss, appid, game.get("name", ""))

        # 3. 리뷰 수집
        last_cursor = game.get("last_cursor", "") or "*"
        total_count = int(game.get("total_reviews_count", 0) or 0)
        if total_count == 0:
            total_count = get_total_review_count(appid)
            update_game(ss, appid, {"total_reviews_count": total_count})

        reviews, next_cursor, _ = collect_reviews_batch(
            appid, last_cursor, max_pages=MAX_PAGES_PER_RUN
        )

        if reviews:
            # ── Sheet Pool에서 시트 할당 ──────────────────────────────────────
            # 서비스 계정은 파일을 생성할 수 없으므로(Drive 0GB 할당량 제한),
            # 관리자가 사전 생성한 시트를 Sheet_Pool 탭에서 꺼내 사용합니다.
            sheet_id = allocate_sheet(ss, appid)

            if sheet_id is None:
                # 풀 고갈 — 크래시 없이 우아하게 처리
                print(f"[POOL EMPTY] {game.get('name')} (AppID={appid})")
                print("[POOL EMPTY] Sheet_Pool에 여유 시트가 없습니다. status=error_pool_empty로 설정.")
                print("[POOL EMPTY] 관리자가 Sheet_Pool 탭에 새 시트를 추가한 후 retry 필요.")
                update_game(ss, appid, {"status": "error_pool_empty"})
                continue  # 이 게임은 건너뜀, 다음 게임으로 진행

            # 할당된 시트 열기 (파일 생성 없음)
            try:
                raw_ss = open_raw_spreadsheet(sheet_id)
            except Exception as e:
                print(f"[ERROR] 시트 열기 실패 (sheet_id={sheet_id}): {e}")
                print("[ERROR] 서비스 계정이 해당 시트에 편집 권한이 있는지 확인하세요.")
                update_game(ss, appid, {"status": "error_pool_empty"})
                continue

            added = append_reviews(raw_ss, reviews)
            print(f"리뷰 {added}건 신규 추가 (시트: {sheet_id})")

            collected = int(game.get("collected_reviews_count", 0) or 0) + added
            updates = {
                "last_cursor": next_cursor,
                "collected_reviews_count": collected,
            }

            # 수집 완료 판정 (커서 동일 = 끝)
            if next_cursor == last_cursor or next_cursor == "*":
                updates["status"] = "active"
                updates["last_cursor"] = ""
                print("수집 완료 → active 전환")

            update_game(ss, appid, updates)

        else:
            # 리뷰 없음 = 이미 최신
            if status == "collecting":
                update_game(ss, appid, {"status": "active", "last_cursor": ""})
                print("수집 완료 (신규 없음) → active 전환")

    print("\n전체 수집 완료")


def _collect_news(ss, appid: str, game_name: str):
    from sheets.master_sheet import get_timeline, append_timeline_row, get_or_create_timeline_tab
    existing = get_timeline(ss, appid)
    existing_urls = {r.get("url") for r in existing if r.get("url")}
    existing_titles = {r.get("title") for r in existing if r.get("title")}

    news_items = fetch_news(appid)
    official, external = classify_news(news_items)

    added = 0
    for item in official + external:
        ev_type = "official" if item in official else "news"
        parsed = parse_news_item(item, ev_type)
        url = parsed.get("url", "")
        title = parsed.get("title", "")
        if url and url in existing_urls:
            continue
        if title and title in existing_titles:
            continue
        append_timeline_row(ss, appid, {**parsed, "language_scope": "all"})
        existing_urls.add(url)
        existing_titles.add(title)
        added += 1

    if added:
        print(f"뉴스/패치 {added}건 추가")
        all_official = [
            r for r in get_timeline(ss, appid)
            if r.get("event_type") in ("official", "manual") and r.get("date")
        ]
        if all_official:
            last_date = max(r["date"] for r in all_official)
            update_game(ss, appid, {"last_event_date": last_date})


if __name__ == "__main__":
    run()
