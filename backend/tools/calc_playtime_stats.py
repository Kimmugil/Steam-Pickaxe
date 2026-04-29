"""
플레이타임 구간별 통계 사전 계산 도구.

RAW 리뷰 시트에서 playtime_at_review + voted_up을 읽어
P25/P75 퍼센타일 기반으로 신규/일반/헤비 구간을 나누고,
각 구간의 리뷰 수 및 긍정률을 계산한다.

결과는 master sheet의 playtime_stats (JSON), playtime_stats_date 컬럼에 저장된다.

직접 실행 시:
    python tools/calc_playtime_stats.py [appid]
    appid 생략 시 전체 active 게임 일괄 처리

수집 파이프라인(main_collect.py)에서 직접 호출되기도 한다.
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timezone
from sheets.master_sheet import get_spreadsheet, get_all_games, update_game
from sheets.raw_reviews import open_raw_spreadsheet

# RAW_HEADERS 인덱스
IDX_VOTED_UP    = 1  # "voted_up"
IDX_PLAYTIME    = 5  # "playtime_at_review"

MIN_REVIEWS = 30  # 통계를 내기에 너무 적으면 건너뜀


def _parse_int(v) -> int | None:
    try:
        return int(v)
    except (ValueError, TypeError):
        return None


def _parse_bool(v) -> bool | None:
    s = str(v).strip().upper()
    if s in ("TRUE", "1", "YES"):
        return True
    if s in ("FALSE", "0", "NO"):
        return False
    return None


def calc_for_game(game_sheet_id: str) -> dict | None:
    """
    개별 게임 RAW 시트에서 playtime_stats dict를 계산하여 반환한다.
    데이터 부족 시 None 반환.

    반환 형식:
    {
        "p25": int,           # 퍼센타일 25 (신규/일반 경계, 분 단위)
        "p75": int,           # 퍼센타일 75 (일반/헤비 경계, 분 단위)
        "new":   { "total": int, "positive": int, "rate": int },
        "mid":   { "total": int, "positive": int, "rate": int },
        "heavy": { "total": int, "positive": int, "rate": int },
        "total": int,         # 유효 리뷰 총 수
    }
    """
    try:
        raw_ss = open_raw_spreadsheet(game_sheet_id)
    except Exception as e:
        print(f"  [playtime] RAW 시트 열기 실패: {e}")
        return None

    # 연도별 탭을 모두 읽어 합산
    playtimes: list[int] = []
    voted_ups: list[bool] = []

    worksheets = raw_ss.worksheets()
    review_tabs = [ws for ws in worksheets if ws.title.startswith("reviews_")]

    if not review_tabs:
        print("  [playtime] reviews_* 탭 없음 — 건너뜀")
        return None

    for ws in review_tabs:
        rows = ws.get_all_values()
        if len(rows) < 2:
            continue
        for row in rows[1:]:
            if len(row) <= IDX_PLAYTIME:
                continue
            pt = _parse_int(row[IDX_PLAYTIME])
            vu = _parse_bool(row[IDX_VOTED_UP])
            if pt is None or vu is None:
                continue
            playtimes.append(pt)
            voted_ups.append(vu)

    total = len(playtimes)
    if total < MIN_REVIEWS:
        print(f"  [playtime] 유효 리뷰 {total}건 — 통계 불가 (최소 {MIN_REVIEWS}건 필요)")
        return None

    sorted_pt = sorted(playtimes)
    p25_idx = int(total * 0.25)
    p75_idx = int(total * 0.75)
    p25 = sorted_pt[p25_idx]
    p75 = sorted_pt[p75_idx]

    # 구간 집계
    segs = {"new": [0, 0], "mid": [0, 0], "heavy": [0, 0]}  # [total, positive]
    for pt, vu in zip(playtimes, voted_ups):
        if pt < p25:
            key = "new"
        elif pt <= p75:
            key = "mid"
        else:
            key = "heavy"
        segs[key][0] += 1
        if vu:
            segs[key][1] += 1

    def seg_dict(total: int, pos: int) -> dict:
        rate = round(pos / total * 100) if total > 0 else 0
        return {"total": total, "positive": pos, "rate": rate}

    return {
        "p25":   p25,
        "p75":   p75,
        "new":   seg_dict(*segs["new"]),
        "mid":   seg_dict(*segs["mid"]),
        "heavy": seg_dict(*segs["heavy"]),
        "total": total,
    }


def run(target_appid: str = "") -> None:
    ss = get_spreadsheet()
    games = get_all_games(ss)
    today = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")

    for game in games:
        appid = str(game.get("appid", ""))
        if target_appid and appid != target_appid:
            continue
        status = game.get("status", "")
        if status not in ("active", "collecting"):
            continue
        game_sheet_id = game.get("game_sheet_id", "")
        if not game_sheet_id:
            print(f"\n[{appid}] game_sheet_id 없음 — 건너뜀")
            continue

        print(f"\n[{appid}] {game.get('name', '')} — 플레이타임 통계 계산 중...")
        stats = calc_for_game(game_sheet_id)
        if stats is None:
            continue

        update_game(ss, appid, {
            "playtime_stats":      json.dumps(stats, ensure_ascii=False),
            "playtime_stats_date": today,
        })
        print(f"  → 저장 완료 (P25={stats['p25']}분, P75={stats['p75']}분, total={stats['total']}건)")


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else ""
    run(target)
