"""
Steam News & Store API — 공식 패치노트 + 외부 뉴스 수집
기획서 3.B: feed_type=1(공식), feed_type=0(외부), appauthor 폴백
"""
import requests
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import STEAM_NEWS_ENDPOINT, STEAM_API_KEY


def fetch_news(appid: str, count: int = 250) -> list[dict]:
    params = {
        "appid": appid,
        "count": count,
        "maxlength": 3000,
        "format": "json",
    }
    if STEAM_API_KEY:
        params["key"] = STEAM_API_KEY

    try:
        r = requests.get(STEAM_NEWS_ENDPOINT, params=params, timeout=20)
        r.raise_for_status()
        data = r.json()
        return data.get("appnews", {}).get("newsitems", [])
    except Exception as e:
        print(f"[steam_news] 오류 appid={appid}: {e}")
        return []


def classify_news(items: list[dict], app_author: str = "") -> tuple[list[dict], list[dict]]:
    """
    Returns: (official_patches, external_news)
    feed_type=1 → 공식. 그 외에서 appauthor 매칭 시 공식으로 분류.
    """
    official = []
    external = []
    for item in items:
        feed_type = item.get("feed_type", -1)
        author = item.get("author", "").lower()
        is_official = (feed_type == 1) or (app_author and app_author.lower() in author)
        if is_official:
            official.append(item)
        else:
            external.append(item)
    return official, external


def parse_news_item(item: dict, event_type: str) -> dict:
    import uuid as _uuid
    return {
        "event_id": str(_uuid.uuid4()),
        "event_type": event_type,
        "date": _format_date(item.get("date", 0)),
        "title": item.get("title", ""),
        "url": item.get("url", ""),
        "language_scope": "all",
        "is_sale_period": False,
        "sale_text": "",
        "is_free_weekend": False,
    }


def _format_date(ts: int) -> str:
    from datetime import datetime, timezone
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).strftime("%Y-%m-%d")
    except Exception:
        return ""


def fetch_sale_info(appid: str) -> dict:
    """할인 기간 정보 — 실패 시 graceful degradation (빈 dict)"""
    try:
        r = requests.get(
            "https://store.steampowered.com/api/appdetails",
            params={"appids": appid, "filters": "price_overview"},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json().get(str(appid), {})
        if data.get("success"):
            price = data.get("data", {}).get("price_overview", {})
            discount = price.get("discount_percent", 0)
            return {
                "discount_percent": discount,
                "is_sale": discount > 0,
                "final_price": price.get("final", 0),
            }
    except Exception:
        pass
    return {}
