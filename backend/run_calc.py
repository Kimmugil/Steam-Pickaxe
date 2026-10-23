"""
계산 단계 일괄 실행 (AI 없음, 몇 분 안에 끝남): 지표·진단 → 급변 감지 → 업데이트 영향
  python run_calc.py                 # 진행 중인 모든 게임
  python run_calc.py --appid 3564740 # 특정 게임
"""
import argparse
import sys

from common import connect, job
import impact
import metrics
import shifts


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--appid", type=int, nargs="*")
    ap.add_argument("--no-save", action="store_true", help="계산만 하고 저장하지 않음 (시험용)")
    a = ap.parse_args()
    with job("calc") as run:
        conn = connect()
        games = conn.execute("select appid, name from games where status = 'active' order by appid").fetchall()
        for appid, name in games:
            if a.appid and appid not in a.appid:
                continue
            try:
                found = shifts.detect(shifts.load_daily(conn, appid))
                added = 0 if a.no_save else shifts.save_new(conn, appid, found)
                imp = {"candidates": 0, "saved": 0, "unchanged": 0} if a.no_save else impact.run_game(conn, appid)
                m = metrics.compute_metrics(conn, appid)
                if not a.no_save:
                    metrics.save_metrics(conn, appid, m)
                run.summary[str(appid)] = {"diagnosis": m["diagnosis"], "shifts_new": added, "impact_saved": imp["saved"]}
                print(f"[계산] {name}: 진단={m['diagnosis']} | 30일 긍정률 {m['pos30']} | 리뷰 속도 {m['velocity']}/일 ({m['velocity_change']}%)"
                      f" | 동접 변화 {m['ccu_change']} | 활성 리뷰어 {m['active_share']} | 급변 감지 {len(found)}건(새로 {added}) | 영향 분석 새로 {imp['saved']}건",
                      flush=True)
            except Exception as e:
                print(f"[오류] {name}: {type(e).__name__}: {e}", flush=True)
                run.summary[str(appid)] = {"error": f"{type(e).__name__}: {e}"[:300]}
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
