"""
새 게임 등록. 이름·대표 이미지·장르·가격을 Steam에서 가져와 '수집 중' 상태로 넣습니다.
이후 collect.py 가 가장 먼저 이 게임의 전체 리뷰를 수집하고, 끝나면 '진행 중'으로 바뀝니다.

  python add_game.py 1245620
"""
import re
import sys

from common import connect, job
from steam_meta import fetch_app_details, save_app_details


def parse_appid(text: str) -> int:
    """AppID 숫자 또는 Steam 상점 주소(store.steampowered.com/app/숫자/...) 모두 받습니다."""
    m = re.search(r"/app/(\d+)", text) or re.fullmatch(r"\s*(\d+)\s*", text)
    if not m:
        raise ValueError("AppID 숫자나 Steam 상점 주소를 입력해 주세요.")
    return int(m.group(1))


def add_game(conn, appid: int) -> str:
    meta = fetch_app_details(appid)
    if not meta or not meta.get("name"):
        raise RuntimeError(f"Steam에서 AppID {appid} 의 정보를 찾지 못했습니다.")
    conn.execute("""insert into games (appid, name, status, tier) values (%s, %s, 'collecting', 'hot')
                    on conflict (appid) do update set status = case when games.status = 'archived' then 'collecting' else games.status end""",
                 (appid, meta["name"]))
    save_app_details(conn, appid, meta)
    return meta["name"]


def main() -> int:
    appid = parse_appid(sys.argv[1] if len(sys.argv) > 1 else "")
    with job("add_game") as run:
        conn = connect()
        name = add_game(conn, appid)
        run.summary.update({"appid": appid, "name": name})
        conn.close()
    print(f"등록 완료: {name} ({appid}) — 다음 수집 때 전체 리뷰를 받습니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
