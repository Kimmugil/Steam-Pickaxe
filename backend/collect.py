"""
리뷰 수집기 (하루 한 번 점검 + 필요한 게임만 수집)

  python collect.py run                      # 점검 → 수집할 때가 된 게임만 수집 (자동 실행용)
  python collect.py run --appid 1623730      # 특정 게임만 (보관 중인 게임도 가능)
  python collect.py run --force              # 때가 아니어도 모든 진행 중 게임 수집
  python collect.py probe                    # 점검만 (새 리뷰 수 확인, 정보·가격 갱신)

동작 원리
  1) 점검: 게임마다 Steam에 요청 1번으로 전체 리뷰 수를 확인하고, 활동량에 따라 수집 단계를 정합니다.
  2) 수집: 최신 리뷰부터 거꾸로 훑으며 저장합니다.
     "이미 저장돼 있고 플레이타임까지 채워진 페이지"를 만나면 거기서 멈춥니다.
     → 평소에는 몇 페이지만 받고 끝나고, 처음에는(플레이타임이 비어 있는 과거분) 자동으로 끝까지 채웁니다.
  3) 시간이 모자라면 위치(커서)를 저장하고 끝냅니다. 다음 실행이 그 자리부터 이어받습니다.
"""
import argparse
import sys
import time
from datetime import timedelta

from common import THROTTLE, connect, job, now_utc
from steam_meta import fetch_app_details, save_app_details
from steam_reviews import UPSERT_SQL, fetch_page, fetch_summary, parse_review

# 수집 단계별 수집 간격(일). 하루 리뷰 수가 많을수록 자주 받습니다.
INTERVAL_DAYS = {"hot": 1, "mid": 3, "calm": 10, "idle": 30}
BURST_NEW_REVIEWS = 500        # 간격이 안 됐어도, 마지막 수집 뒤 새 리뷰가 이만큼 쌓이면 앞당겨 수집
PAGE_SLEEP = 1.8               # Steam에 부담을 주지 않도록 페이지 사이 기본 대기(초). 제한 신호를 받으면 자동으로 늘어남
MAX_BLOCKED_GAMES = 2          # 연달아 이만큼의 게임에서 Steam이 응답하지 않으면 이번 실행을 접고 다음 실행으로 넘김
SAVE_CURSOR_EVERY = 25         # 이 페이지 수마다 진행 위치를 DB에 저장


def tier_from_velocity(v: float | None, release_days: int | None) -> str | None:
    if release_days is not None and release_days < 30:
        return "hot"
    if v is None:
        return None
    return "hot" if v >= 100 else "mid" if v >= 10 else "calm" if v >= 1 else "idle"


def review_velocity(conn, appid: int) -> float | None:
    """하루 새 리뷰 수. 점검 기록(총 리뷰 수)이 3일 넘게 쌓였으면 그걸로, 아니면 저장된 리뷰의 최근 14일로 계산."""
    rows = conn.execute("""select day, total_reviews from rate_history
                           where appid = %s and total_reviews is not null and day >= current_date - 30
                           order by day""", (appid,)).fetchall()
    if len(rows) >= 2 and (rows[-1][0] - rows[0][0]).days >= 3:
        days = (rows[-1][0] - rows[0][0]).days
        return max(0, rows[-1][1] - rows[0][1]) / days
    r = conn.execute("""select coalesce(sum(pos + neg), 0), max(day) from review_daily
                        where appid = %s and day >= current_date - 14""", (appid,)).fetchone()
    latest = conn.execute("select max(day) from review_daily where appid = %s", (appid,)).fetchone()[0]
    if latest is not None and (now_utc().date() - latest).days <= 21:
        return r[0] / 14
    return None


# ───────────────────────── 1) 점검 ─────────────────────────
def probe_all(conn, appids=None, skip_meta=False) -> dict:
    out = {"probed": 0, "failed": 0}
    games = conn.execute("""select appid, name, release_date, tier, tier_override from games
                            where status in ('active', 'collecting') or appid = any(%s)
                            order by appid""", (list(appids or []),)).fetchall()
    for appid, name, release_date, tier, tier_override in games:
        if appids and appid not in appids:
            continue
        qs = fetch_summary(appid)
        if not qs:
            print(f"[점검] {name}: 실패", flush=True)
            out["failed"] += 1
            continue
        total = int(qs.get("total_reviews") or 0)
        pos, neg = int(qs.get("total_positive") or 0), int(qs.get("total_negative") or 0)
        rate = round(pos / (pos + neg) * 100, 2) if pos + neg else None
        conn.execute("""update games set steam_total_reviews = %s, steam_positive_rate = %s,
                        last_probe_at = now(), last_probe_total = %s where appid = %s""", (total, rate, total, appid))
        conn.execute("""insert into rate_history (appid, day, positive_rate, total_reviews) values (%s, current_date, %s, %s)
                        on conflict (appid, day) do update set positive_rate = excluded.positive_rate,
                        total_reviews = excluded.total_reviews""", (appid, rate, total))
        if not skip_meta:
            meta = fetch_app_details(appid)
            if meta:
                save_app_details(conn, appid, meta)
            time.sleep(1.2)  # appdetails는 요청 제한이 빡빡해서 천천히
        rel_days = (now_utc().date() - release_date).days if release_date else None
        new_tier = tier_from_velocity(review_velocity(conn, appid), rel_days)
        if new_tier and tier_override is None and new_tier != tier:
            conn.execute("update games set tier = %s where appid = %s", (new_tier, appid))
        print(f"[점검] {name}: Steam 전체 {total:,}건, 긍정률 {rate}%", flush=True)
        out["probed"] += 1
        time.sleep(0.5)
    return out


# ───────────────────────── 2) 수집 대상 고르기 ─────────────────────────
def pick_due(conn, appids=None, force=False) -> list[dict]:
    cols = ["appid", "name", "status", "tier", "tier_override", "review_cursor", "last_collected_at",
            "last_collected_total", "steam_total_reviews"]
    rows = conn.execute(f"select {', '.join(cols)} from games order by appid").fetchall()
    due = []
    for r in rows:
        g = dict(zip(cols, r))
        if appids:
            if g["appid"] not in appids:
                continue
            due.append((0, g)); continue          # 지정한 게임은 상태와 무관하게 수집
        if g["status"] not in ("active", "collecting"):
            continue
        tier = g["tier_override"] or g["tier"]
        interval = timedelta(days=INTERVAL_DAYS[tier])
        last = g["last_collected_at"]
        grew = (g["steam_total_reviews"] or 0) - (g["last_collected_total"] or 0)
        if g["status"] == "collecting":
            due.append((0, g))                    # 새 게임이 가장 먼저
        elif force or g["review_cursor"] or last is None or now_utc() >= last + interval or grew >= BURST_NEW_REVIEWS:
            due.append((1 if g["review_cursor"] else 2, g))
    due.sort(key=lambda x: (x[0], x[1]["last_collected_at"] or now_utc() - timedelta(days=9999)))
    return [g for _, g in due]


# ───────────────────────── 3) 수집 ─────────────────────────
def collect_game(conn, g: dict, deadline: float, full: bool = False) -> dict:
    appid, name = g["appid"], g["name"]
    cursor = g["review_cursor"] or "*"
    stats = {"pages": 0, "seen": 0, "new": 0, "finished": False, "stopped_early": False, "resumed": cursor != "*"}
    # 이어받기 중이거나 --full 이면 '이미 채워진 페이지'를 만나도 멈추지 않고 끝까지 갑니다.
    # (중간에 끊긴 뒤 이어받을 때, 이미 처리한 구간 때문에 일찍 끝나 버리는 일을 막기 위해)
    early_stop_ok = cursor == "*" and not full
    oldest_seen = None
    refreshed_new = 0
    pend_new = pend_pt = 0
    steam_total = g["steam_total_reviews"]
    print(f"[수집] {name} ({appid}) 시작 — {'이어받기' if stats['resumed'] else '처음부터(최신순)'}", flush=True)
    while True:
        data = fetch_page(appid, cursor)
        for cool in range(2):                       # Steam 제한이 걸렸을 수 있으니 5분씩 쉬며 최대 2번 더 시도
            if data is not None:
                break
            print(f"  페이지를 받지 못해 5분 쉬고 다시 시도합니다 ({cool + 1}/2)", flush=True)
            time.sleep(300)
            data = fetch_page(appid, cursor)
        if data is None:
            print("  계속 받지 못해 중단합니다. 저장된 위치에서 다음에 이어받습니다.", flush=True)
            stats["blocked"] = True
            break
        steam_total = (data.get("query_summary") or {}).get("total_reviews", steam_total) or steam_total
        reviews = data.get("reviews") or []
        if not reviews:
            stats["finished"] = True
            break
        observed = now_utc()
        rows = [x for x in (parse_review(r, appid, observed) for r in reviews) if x]
        ids = [x["recommendationid"] for x in rows]
        known = dict(conn.execute("""select recommendationid, playtime_forever is not null from reviews
                                     where appid = %s and recommendationid = any(%s)""", (appid, ids)).fetchall())
        with conn.cursor() as cur:
            cur.executemany(UPSERT_SQL, rows)
        stats["pages"] += 1
        stats["seen"] += len(rows)
        stats["new"] += sum(1 for i in ids if i not in known)
        pend_new += sum(1 for i in ids if i not in known)                 # 현황판 숫자를 도중에도 맞추기 위한 증감분
        pend_pt += sum(1 for r in rows if r["playtime_forever"] is not None and known.get(r["recommendationid"]) is not True)
        if rows:
            low = min(x["created_at"] for x in rows)
            oldest_seen = low if oldest_seen is None or low < oldest_seen else oldest_seen
        if early_stop_ok and rows and all(known.get(i) for i in ids):      # 전부 저장돼 있고 플레이타임도 채워진 페이지
            stats["finished"] = stats["stopped_early"] = True
            break
        new_cursor = data.get("cursor")
        if not new_cursor or new_cursor == cursor:
            stats["finished"] = True
            break
        cursor = new_cursor
        if stats["pages"] % SAVE_CURSOR_EVERY == 0:
            conn.execute("""update games set review_cursor = %s, reviews_collected = reviews_collected + %s,
                            reviews_with_playtime = reviews_with_playtime + %s where appid = %s""", (cursor, pend_new, pend_pt, appid))
            pend_new = pend_pt = 0
            if stats["new"] > refreshed_new and oldest_seen is not None:   # 최근 120일 구간만 가볍게 다시 집계
                since = max(oldest_seen.date(), now_utc().date() - timedelta(days=120))
                conn.execute("select refresh_review_daily_range(%s, %s)", (appid, since))
                refreshed_new = stats["new"]
            print(f"  … {time.strftime('%H:%M:%S')} {stats['pages']}페이지 ({stats['seen']:,}건 확인, 새로 {stats['new']:,}건, 대기 {PAGE_SLEEP + THROTTLE['penalty']:.1f}초)", flush=True)
        if time.time() >= deadline:
            print("  시간 예산을 다 써서 여기까지 저장하고 멈춥니다.", flush=True)
            break
        THROTTLE["penalty"] = max(0.0, THROTTLE["penalty"] - 0.02)
        time.sleep(PAGE_SLEEP + THROTTLE["penalty"])

    if stats["finished"]:
        interval = INTERVAL_DAYS[g["tier_override"] or g["tier"]]
        conn.execute("""update games set review_cursor = null, last_collected_at = now(),
                        last_collected_total = %s, next_collect_at = now() + make_interval(days => %s),
                        status = case when status = 'collecting' then 'active' else status end
                        where appid = %s""", (steam_total, interval, appid))
    else:
        conn.execute("update games set review_cursor = %s where appid = %s", (cursor, appid))
    if stats["new"] > 0:
        conn.execute("select refresh_review_daily(%s)", (appid,))
    conn.execute("select refresh_game_counts(%s)", (appid,))
    print(f"[수집] {name}: {stats['pages']}페이지, 새 리뷰 {stats['new']:,}건"
          f"{' (끝까지 완료)' if stats['finished'] and not stats['stopped_early'] else ' (최신 구간 동기화 완료)' if stats['stopped_early'] else ' (이어받기 필요)'}",
          flush=True)
    return stats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["run", "probe"])
    ap.add_argument("--appid", type=int, nargs="*")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--skip-meta", action="store_true", help="상점 정보·가격 갱신을 건너뜀")
    ap.add_argument("--full", action="store_true", help="이미 채워진 페이지를 만나도 멈추지 않고 끝까지 훑음 (복구용)")
    ap.add_argument("--budget-min", type=float, default=330, help="이번 실행에 쓸 최대 시간(분)")
    a = ap.parse_args()
    deadline = time.time() + a.budget_min * 60
    appids = set(a.appid or [])
    with job("collect" if a.command == "run" else "probe") as run:
        conn = connect()
        run.summary["probe"] = probe_all(conn, appids or None, a.skip_meta)
        if a.command == "run":
            due = pick_due(conn, appids or None, a.force)
            print(f"\n수집 대상 {len(due)}개: {[g['name'] for g in due]}", flush=True)
            run.summary["games"] = {}
            blocked_games = 0
            for g in due:
                if time.time() >= deadline:
                    print(f"시간 예산이 끝나 {g['name']} 이후는 다음 실행으로 넘깁니다.", flush=True)
                    break
                if blocked_games >= MAX_BLOCKED_GAMES:
                    print("Steam이 계속 응답하지 않아(일시 차단으로 보임) 이번 실행을 여기서 접습니다. 다음 실행이 저장된 위치에서 이어받습니다.", flush=True)
                    run.summary["blocked"] = True
                    break
                try:
                    res = collect_game(conn, g, deadline, a.full)
                    blocked_games = blocked_games + 1 if res.get("blocked") else 0
                    run.summary["games"][g["appid"]] = res
                except Exception as e:      # 한 게임이 실패해도 나머지는 계속
                    print(f"[오류] {g['name']}: {type(e).__name__}: {e}", flush=True)
                    run.summary["games"][g["appid"]] = {"error": f"{type(e).__name__}: {e}"[:300]}
                    try:
                        conn.close()
                    except Exception:
                        pass
                    conn = connect()                 # 접속이 끊겼을 수 있으니 새로 연결
            errs = [k for k, v in run.summary["games"].items() if "error" in v]
            if errs and len(errs) == len(run.summary["games"]):
                raise RuntimeError(f"모든 게임에서 오류: {errs}")
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
