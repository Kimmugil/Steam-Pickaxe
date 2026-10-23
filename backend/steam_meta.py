"""Steam 상점 정보(이름·대표 이미지·장르·가격)와 현재 접속자 수"""
import re
from datetime import date, datetime

from common import get_json, now_utc

APPDETAILS = "https://store.steampowered.com/api/appdetails"
CCU_URL = "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/"
EARLY_ACCESS_GENRE_ID = "70"


def parse_release(text) -> date | None:
    t = (text or "").strip()
    if not t:
        return None
    for fmt in ("%b %d, %Y", "%d %b, %Y", "%d %b %Y", "%b %d %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(t, fmt).date()
        except ValueError:
            pass
    m = re.search(r"(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일", t)
    return date(int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else None


def fetch_app_details(appid: int) -> dict | None:
    """appdetails 한 번 호출로 게임 정보와 현재 가격을 한꺼번에 얻습니다. 실패하면 None."""
    d = get_json(APPDETAILS, {"appids": appid, "cc": "us", "l": "english"})
    node = (d or {}).get(str(appid)) or {}
    if not node.get("success"):
        return None
    x = node.get("data") or {}
    po = x.get("price_overview") or {}
    genres = x.get("genres") or []
    rel = (x.get("release_date") or {}).get("date")
    return {
        "name": x.get("name"),
        "thumbnail": x.get("header_image"),
        "release_date_text": rel,
        "release_date": parse_release(rel),
        "genres": [g.get("description") for g in genres if g.get("description")],
        "developer": ", ".join(x.get("developers") or []) or None,
        "publisher": ", ".join(x.get("publishers") or []) or None,
        "is_free": bool(x.get("is_free")),
        "is_early_access": any(str(g.get("id")) == EARLY_ACCESS_GENRE_ID for g in genres),
        "price": po.get("final_formatted") or ("Free" if x.get("is_free") else None),
        "price_final": po.get("final"),
        "discount_percent": po.get("discount_percent", 0) if po else 0,
    }


def save_app_details(conn, appid: int, m: dict):
    """비어 있지 않은 값만 덮어쓰고, 오늘의 가격·할인율을 기록합니다."""
    conn.execute("""
        update games set
          name = coalesce(%(name)s, name), thumbnail = coalesce(%(thumbnail)s, thumbnail),
          release_date = coalesce(%(release_date)s, release_date),
          release_date_text = coalesce(%(release_date_text)s, release_date_text),
          genres = case when cardinality(%(genres)s::text[]) > 0 then %(genres)s::text[] else genres end,
          developer = coalesce(%(developer)s, developer), publisher = coalesce(%(publisher)s, publisher),
          price = coalesce(%(price)s, price), is_free = %(is_free)s, is_early_access = %(is_early_access)s
        where appid = %(appid)s""", {**m, "appid": appid})
    conn.execute("""
        insert into price_history (appid, day, price_final, discount_percent) values (%s, current_date, %s, %s)
        on conflict (appid, day) do update set price_final = excluded.price_final, discount_percent = excluded.discount_percent""",
                 (appid, m.get("price_final"), m.get("discount_percent") or 0))


def fetch_current_ccu(appid: int) -> int | None:
    d = get_json(CCU_URL, {"appid": appid}, retries=3, quiet=True)
    resp = (d or {}).get("response") or {}
    if resp.get("result") == 1 and isinstance(resp.get("player_count"), int):
        return resp["player_count"]
    return None
