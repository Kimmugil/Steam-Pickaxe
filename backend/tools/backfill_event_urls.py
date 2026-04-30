"""
각 게임의 타임라인에서 가장 최근 공식 이벤트 URL을 읽어
마스터 시트 games 탭의 latest_official_event_url 컬럼을 채웁니다.

[언제 쓰나]
  latest_official_event_url 컬럼이 새로 생겨서 기존 데이터에 값이 없을 때 1회 실행.
  이후에는 main_collect.py 가 수집할 때마다 자동으로 채워줌.

[실행 방법]
  cd backend
  python tools/backfill_event_urls.py              # 전체 게임
  python tools/backfill_event_urls.py --appid 1234  # 특정 게임만
  python tools/backfill_event_urls.py --dry-run     # 실제 저장 없이 미리보기
"""

import sys, os, argparse, time
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sheets.master_sheet import get_spreadsheet, get_all_games, update_game, ensure_games_headers
from sheets.game_sheet   import open_game_sheet, get_timeline


def main():
    parser = argparse.ArgumentParser(description="latest_official_event_url 소급 채우기")
    parser.add_argument("--appid",   default="", help="특정 게임 AppID만 처리 (생략 시 전체)")
    parser.add_argument("--dry-run", action="store_true", help="저장 없이 미리보기")
    args = parser.parse_args()

    dry = args.dry_run
    if dry:
        print("[DRY-RUN] 실제 저장은 하지 않습니다.\n")

    ss = get_spreadsheet()

    # 마스터 시트에 컬럼이 없으면 먼저 추가
    print("[1/3] 마스터 시트 헤더 확인 및 마이그레이션...")
    ensure_games_headers(ss)

    # 전체 게임 목록 로드 (캐시 구성 겸)
    print("[2/3] 게임 목록 로드...")
    games = get_all_games(ss)
    if args.appid:
        games = [g for g in games if str(g.get("appid")) == args.appid]
        if not games:
            print(f"[ERROR] appid={args.appid} 게임을 찾을 수 없습니다.")
            sys.exit(1)

    print(f"      → {len(games)}개 게임 처리 예정\n")

    # 각 게임 타임라인에서 최신 official 이벤트 URL 읽기
    print("[3/3] 타임라인 조회 및 URL 백필...")
    updated = 0
    skipped = 0
    no_event = 0

    for i, game in enumerate(games, 1):
        appid        = str(game.get("appid", ""))
        name         = game.get("name_kr") or game.get("name", appid)
        game_sheet_id = str(game.get("game_sheet_id", ""))
        existing_url  = str(game.get("latest_official_event_url", "")).strip()

        prefix = f"  [{i:>3}/{len(games)}] {name[:30]:<30}"

        # 이미 값이 있으면 스킵
        if existing_url:
            print(f"{prefix} → 이미 있음 (스킵)")
            skipped += 1
            continue

        if not game_sheet_id:
            print(f"{prefix} → game_sheet_id 없음 (스킵)")
            skipped += 1
            continue

        # 개별 게임 시트에서 타임라인 읽기
        try:
            gs = open_game_sheet(game_sheet_id)
            rows = get_timeline(gs)
        except Exception as e:
            print(f"{prefix} → [ERROR] 시트 열기 실패: {e}")
            skipped += 1
            continue

        # official 이벤트 중 가장 최신 것의 URL 추출
        officials = [
            r for r in rows
            if r.get("event_type") == "official" and r.get("date")
        ]
        if not officials:
            print(f"{prefix} → 공식 이벤트 없음")
            no_event += 1
            continue

        latest = max(officials, key=lambda r: r.get("date", ""))
        url    = str(latest.get("url", "")).strip()

        if not url:
            print(f"{prefix} → URL 없음 (이벤트: {latest.get('title', '')[:30]})")
            no_event += 1
            continue

        print(f"{prefix} → {url[:60]}")

        if not dry:
            try:
                update_game(ss, appid, {"latest_official_event_url": url})
                updated += 1
            except Exception as e:
                print(f"             [ERROR] 저장 실패: {e}")
                skipped += 1
        else:
            updated += 1

        # API 쿼터 여유를 위해 약간 대기
        time.sleep(0.5)

    print(f"\n{'[DRY-RUN] ' if dry else ''}완료!")
    print(f"  업데이트: {updated}건 | 스킵: {skipped}건 | 이벤트 없음/URL 없음: {no_event}건")


if __name__ == "__main__":
    main()
