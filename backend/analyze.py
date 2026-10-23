"""
AI 분석 실행기 (자동 복구 포함)

  python analyze.py plan                       # 해야 할 분석이 무엇이고 몇 건인지만 보기 (AI 호출 없음)
  python analyze.py run --max-calls 120        # 빠진·낡은 분석을 우선순위대로 처리 (최대 N회 호출)
  python analyze.py run --appid 1601580 --kinds report monthly
  python analyze.py brief                      # 최근 4주 브리핑과 (매월 1일엔) 월간 리포트 만들기

"빠진 것만 이어서" 처리하기 때문에, 중간에 멈추거나 실패해도 다음 실행이 알아서 마저 합니다.
같은 작업이 연달아 3번 실패하면 24시간 동안 쉬고 관리자 '해야 할 일'에 올립니다.
"""
import argparse
import collections
import sys
from datetime import timedelta

import ai_tasks
import briefs
import gemini
from common import connect, job, now_utc


def blocked(conn, t: dict) -> bool:
    r = conn.execute("""select status, attempts, updated_at from analysis_tasks
                        where appid=%s and kind=%s and period_key=%s and scope=%s""",
                     (t["appid"], t["kind"], t["period_key"], t["scope"])).fetchone()
    if r and r[0] == "skipped":                 # 관리자가 '건너뛰기'를 누른 작업은 계속 건너뜀
        return True
    return bool(r and r[0] == "failed" and r[1] >= ai_tasks.MAX_ATTEMPTS and now_utc() - r[2] < timedelta(hours=24))


def record(conn, t: dict, ok: bool, err: str | None = None):
    conn.execute("""insert into analysis_tasks (appid, kind, period_key, scope, status, attempts, last_error, updated_at)
                    values (%s,%s,%s,%s,%s,%s,%s,now())
                    on conflict (appid, kind, period_key, scope) do update set status = excluded.status,
                      attempts = case when excluded.status = 'done' then 0 else analysis_tasks.attempts + 1 end,
                      last_error = excluded.last_error, updated_at = now()""",
                 (t["appid"], t["kind"], t["period_key"], t["scope"], "done" if ok else "failed", 0 if ok else 1, err))


def collect_plan(conn, appids, kinds):
    tasks = []
    games = {g["appid"]: g for g in ai_tasks.load_games(conn, appids)}
    for g in games.values():
        tasks += [t for t in ai_tasks.plan_game(conn, g) if not kinds or t["kind"] in kinds]
    tasks.sort(key=lambda t: (t["prio"], t["appid"], t["period_key"], t["scope"]))
    return games, tasks


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["plan", "run", "brief"])
    ap.add_argument("--appid", type=int, nargs="*")
    ap.add_argument("--kinds", nargs="*", choices=["monthly", "shift_explain", "impact_explain", "report"])
    ap.add_argument("--max-calls", type=int, default=120)
    a = ap.parse_args()
    appids, kinds = set(a.appid or []), set(a.kinds or [])

    if a.command == "brief":
        with job("brief") as run:
            conn = connect()
            w4 = briefs.build_w4(conn)
            run.summary["w4_items"] = len(w4["items"])
            print(f"최근 4주 브리핑: 특이사항 게임 {len(w4['items'])}개 / 추적 {w4['tracked']}개")
            if now_utc().day <= 3 or not conn.execute("select 1 from briefs where period = %s", ("m:" + ai_tasks.add_month(now_utc().strftime('%Y-%m'), -1),)).fetchone():
                mb = briefs.build_month(conn)
                run.summary["month_items"] = len(mb["items"])
                print(f"월간 리포트({mb['month']}): 특이사항 게임 {len(mb['items'])}개")
            conn.close()
        return 0

    conn = connect()
    games, tasks = collect_plan(conn, appids, kinds)
    by = collections.Counter(t["kind"] for t in tasks)
    used, cap = gemini.month_calls(conn), gemini.monthly_cap(conn)
    print(f"해야 할 분석 {len(tasks)}건 {dict(by)} | 이번 달 AI 호출 {used}/{cap}회")
    if a.command == "plan":
        for t in tasks[:40]:
            print(f"  [{t['kind']}] {t['name']} {t['period_key']} {t['scope']} — {t['reason']}")
        if len(tasks) > 40:
            print(f"  … 그 밖에 {len(tasks) - 40}건")
        return 0

    with job("analyze") as run:
        done = failed = skipped = 0
        errors: list[str] = []
        for t in tasks:
            if done + failed >= a.max_calls:
                print("이번 실행의 호출 한도에 도달했습니다. 나머지는 다음 실행에서 이어서 처리합니다.")
                break
            if blocked(conn, t):
                skipped += 1
                continue
            g = games[t["appid"]]
            try:
                res = ai_tasks.execute(conn, g, t)
                record(conn, t, True)
                done += 1
                print(f"  완료 [{t['kind']}] {g['name']} {t['period_key']} {t['scope']} {res or ''}", flush=True)
            except gemini.BudgetExceeded as e:
                print(f"  중단: {e}")
                errors.append(str(e))
                break
            except Exception as e:
                failed += 1
                msg = f"{type(e).__name__}: {e}"[:300]
                errors.append(f"{g['name']} {t['kind']} {t['period_key']}: {msg}")
                record(conn, t, False, msg)
                print(f"  실패 [{t['kind']}] {g['name']} {t['period_key']} {t['scope']}: {msg}", flush=True)
        run.summary.update({"done": done, "failed": failed, "skipped_blocked": skipped, "remaining": max(0, len(tasks) - done - failed - skipped),
                            "errors": errors[:10]})
        print(f"처리 {done}건, 실패 {failed}건, 건너뜀(반복 실패) {skipped}건")
        conn.close()
        if failed and not done:
            raise RuntimeError(f"모든 분석 작업이 실패했습니다: {errors[:3]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
