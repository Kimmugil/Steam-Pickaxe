"""
언어 분포 재집계 도구
모든 active 게임의 RAW 리뷰 언어 분포를 재계산하여 마스터 시트를 갱신합니다.

갱신 항목:
  - language_distribution : JSON 직렬화된 언어→리뷰 수 맵 (파이 차트용)
  - top_languages          : 상위 5개 언어 목록
  - collected_reviews_count: RAW 시트 실제 행 수로 보정
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sheets.master_sheet import get_spreadsheet, get_all_games, update_game
from sheets.raw_reviews import open_raw_spreadsheet, get_language_counts

TOP_LANGUAGES_COUNT = 5


def run():
    ss = get_spreadsheet()
    games = get_all_games(ss)

    processed = 0
    skipped   = 0

    for game in games:
        if game.get("status") != "active":
            continue
        game_sheet_id = game.get("game_sheet_id", "")
        if not game_sheet_id:
            continue

        appid = str(game.get("appid", ""))
        name  = game.get("name", appid)
        print(f"\n처리 중: {name} ({appid})")

        try:
            raw_ss      = open_raw_spreadsheet(game_sheet_id)
            lang_counts = get_language_counts(raw_ss)
        except Exception as e:
            print(f"  [SKIP] RAW 시트 접근 실패: {e}")
            skipped += 1
            continue

        if not lang_counts:
            print(f"  [SKIP] 언어 데이터 없음")
            skipped += 1
            continue

        # 언어 분포 JSON (내림차순 정렬)
        lang_dist_str = json.dumps(
            {l: c for l, c in sorted(lang_counts.items(), key=lambda x: x[1], reverse=True)},
            ensure_ascii=False,
        )

        # 상위 언어 목록
        new_top = [
            l for l, _ in sorted(lang_counts.items(), key=lambda x: x[1], reverse=True)
            [:TOP_LANGUAGES_COUNT]
        ]

        # collected_reviews_count 보정 (RAW 실제 행 수 기준)
        actual_count = sum(lang_counts.values())
        stored_count = int(game.get("collected_reviews_count", 0) or 0)

        updates: dict = {
            "language_distribution": lang_dist_str,
            "top_languages":         ",".join(new_top),
        }
        if actual_count != stored_count:
            updates["collected_reviews_count"] = actual_count
            print(f"  [count_fix] {stored_count:,} → {actual_count:,}")

        update_game(ss, appid, updates)

        top3_summary = ", ".join(f"{l}({c:,})" for l, c in
                                 sorted(lang_counts.items(), key=lambda x: x[1], reverse=True)[:3])
        print(f"  완료: 총 {actual_count:,}건 | 상위: {top3_summary}")
        processed += 1

    print(f"\n── 집계 완료: {processed}개 갱신, {skipped}개 건너뜀 ──")


if __name__ == "__main__":
    run()
