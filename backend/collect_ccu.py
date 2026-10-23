"""
동접자 수집 (매 시간). 진행 중인 게임의 현재 접속자 수를 ccu_samples 에 한 줄씩 쌓습니다.
  python collect_ccu.py
"""
import sys
import time

from common import connect, job, now_utc
from steam_meta import fetch_current_ccu


def main() -> int:
    with job("ccu") as run:
        conn = connect()
        games = conn.execute("select appid, name from games where status = 'active' order by appid").fetchall()
        sampled_at = now_utc().replace(second=0, microsecond=0)
        ok = fail = 0
        for appid, name in games:
            ccu = fetch_current_ccu(appid)
            if ccu is None:
                print(f"[동접] {name}: 수집 실패", flush=True)
                fail += 1
            else:
                conn.execute("""insert into ccu_samples (appid, sampled_at, ccu, source) values (%s, %s, %s, 'live')
                                on conflict (appid, sampled_at) do nothing""", (appid, sampled_at, ccu))
                print(f"[동접] {name}: {ccu:,}명", flush=True)
                ok += 1
            time.sleep(0.3)
        run.summary.update({"ok": ok, "failed": fail})
        conn.close()
        if games and ok == 0:
            raise RuntimeError("모든 게임의 동접 수집에 실패했습니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
