"""
Steam News & Store API — 공식 패치노트 + 외부 뉴스 수집
기획서 3.B: feed_type=1(공식), feed_type=0(외부), appauthor 폴백

변경 이력:
  - fetch_news: enddate 기반 페이지네이션 추가 (count=500, 최대 20페이지)
  - fetch_store_events: Steam Store 이벤트 API 추가 (cursor 기반 페이지네이션)
  - parse_store_event: Store 이벤트 → timeline row 변환
"""
import requests
import re
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import STEAM_NEWS_ENDPOINT, STEAM_API_KEY


def _strip_html(html: str, max_len: int = 5000) -> str:
    """HTML 태그 제거 및 최대 길이 제한. 잘린 경우 마커 삽입."""
    if not html:
        return ""
    text = re.sub(r"<[^>]+>", " ", html)           # 태그 제거
    text = re.sub(r"&[a-zA-Z#0-9]+;", " ", text)    # HTML 엔티티 제거
    text = re.sub(r"\s+", " ", text).strip()         # 연속 공백 정리
    if len(text) > max_len:
        return text[:max_len] + "... [이하 생략]"
    return text

STEAM_STORE_EVENTS_URL = "https://store.steampowered.com/events/ajaxgetadjacentpartnerevents/"

# Steam Store event_type 값 → 우리 분류
# 실제 관측된 타입: 9(공지), 10(이벤트), 12(일반), 13(패치노트), 14(업데이트),
#                  15(개발일지), 22(발표), 28(뉴스/공지 변형)
# 참고: Steam 내부 타입 번호는 비공개이므로 관측값 기준으로 점진적 확장
_STORE_OFFICIAL_TYPES = {9, 13, 14, 15, 22, 28}  # "official" (패치노트·개발일지·발표류)
_STORE_NEWS_TYPES     = {10, 12}                  # "news" (이벤트·일반)
_STORE_ALL_TYPES      = _STORE_OFFICIAL_TYPES | _STORE_NEWS_TYPES


def fetch_news(appid: str, count: int = 500) -> list[dict]:
    """
    Steam GetNewsForApp API로 뉴스 수집.
    enddate 파라미터를 활용해 페이지네이션 — 최대 20페이지(최대 10,000건).
    """
    all_items: list[dict] = []
    seen_gids: set = set()
    enddate: int | None = None
    MAX_PAGES = 20

    for page in range(MAX_PAGES):
        params: dict = {
            "appid": appid,
            "count": count,
            "maxlength": 3000,
            "format": "json",
        }
        if enddate is not None:
            params["enddate"] = enddate
        if STEAM_API_KEY:
            params["key"] = STEAM_API_KEY

        try:
            r = requests.get(STEAM_NEWS_ENDPOINT, params=params, timeout=20)
            r.raise_for_status()
            items: list[dict] = r.json().get("appnews", {}).get("newsitems", [])
        except Exception as e:
            print(f"[steam_news] 오류 appid={appid} page={page}: {e}")
            break

        if not items:
            break

        min_date: int | None = None
        new_this_page = 0
        for item in items:
            gid = item.get("gid")
            if gid and gid in seen_gids:
                continue
            if gid:
                seen_gids.add(gid)
            all_items.append(item)
            new_this_page += 1
            d = item.get("date", 0)
            if min_date is None or d < min_date:
                min_date = d

        # 수집된 아이템이 count보다 적거나 중복만 있으면 종료
        if len(items) < count or new_this_page == 0:
            break

        # 다음 페이지: oldest item 날짜 - 1초 이전으로 재조회
        if not min_date or min_date <= 0:
            break
        enddate = min_date - 1

    print(f"[steam_news] appid={appid} GetNewsForApp {len(all_items)}건 수집 ({page + 1}페이지)")
    return all_items


def fetch_store_events(appid: str) -> list[dict]:
    """
    Steam Store 이벤트 API로 패치노트/공지 등 추가 이벤트 수집.
    GetNewsForApp이 누락하는 오래된 이벤트를 보완하는 역할.
    cursor 기반 페이지네이션 — 최대 20페이지.
    announcement_body.gid 기반으로 페이지 간 중복 제거.
    """
    all_events: list[dict] = []
    seen_gids: set = set()   # announcement_body.gid 기반 중복 방지
    cursor = "*"
    MAX_PAGES = 20

    for _ in range(MAX_PAGES):
        params = {
            "appid": appid,
            "count_before": 0,
            "count_after": 250,
            "cursor": cursor,
            "l": "english",
            "include_steamstore_events": 1,
            "ajax": 1,
        }
        try:
            r = requests.get(STEAM_STORE_EVENTS_URL, params=params, timeout=20)
            r.raise_for_status()
            data = r.json()
            events: list[dict] = data.get("events", [])
        except Exception as e:
            print(f"[steam_news] store_events 오류 appid={appid}: {e}")
            break

        if not events:
            break

        new_this_page = 0
        for ev in events:
            body_gid = (ev.get("announcement_body") or {}).get("gid", "")
            if body_gid:
                if body_gid in seen_gids:
                    continue
                seen_gids.add(body_gid)
            all_events.append(ev)
            new_this_page += 1

        # 이번 페이지가 전부 중복이면 더 이상 새 데이터 없음 → 종료
        if new_this_page == 0:
            break

        next_cursor = data.get("next_cursor")
        if not next_cursor or next_cursor == cursor:
            break
        cursor = next_cursor

    print(f"[steam_news] appid={appid} StoreEvents {len(all_events)}건 수집")
    return all_events


def parse_store_event(event: dict, appid: str) -> dict | None:
    """
    Steam Store 이벤트 dict를 timeline row 형식으로 변환.
    알 수 없는 타입이거나 제목이 없으면 None 반환.
    """
    import uuid as _uuid

    event_type_id = event.get("event_type", -1)
    if event_type_id not in _STORE_ALL_TYPES:
        return None

    body: dict = event.get("announcement_body") or {}
    title: str = (event.get("event_name") or body.get("headline") or "").strip()
    if not title:
        return None

    ts: int = event.get("rtime32_start_time", 0) or event.get("rtime32_end_time", 0)
    date_str = _format_date(ts)

    # URL 구성: announcement_body.gid가 있으면 뉴스 포스트 URL
    url = ""
    body_gid = body.get("gid", "")
    if body_gid:
        url = f"https://store.steampowered.com/news/app/{appid}/view/{body_gid}"

    # 이벤트 본문 (HTML 제거 후 저장)
    raw_body = body.get("body", "")
    content = _strip_html(raw_body)

    ev_type = "official" if event_type_id in _STORE_OFFICIAL_TYPES else "news"
    is_sale = event_type_id == 13
    is_fw   = event_type_id == 12

    return {
        "event_id":       str(_uuid.uuid4()),
        "event_type":     ev_type,
        "date":           date_str,
        "title":          title,
        "url":            url,
        "language_scope": "all",
        "is_sale_period": is_sale,
        "sale_text":      "",
        "is_free_weekend": is_fw,
        "content":        content,
    }


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
    # Steam GetNewsForApp API의 "contents" 필드 = 뉴스 본문 (HTML)
    content = _strip_html(item.get("contents", ""))
    return {
        "event_id":       str(_uuid.uuid4()),
        "event_type":     event_type,
        "date":           _format_date(item.get("date", 0)),
        "title":          item.get("title", ""),
        "url":            item.get("url", ""),
        "language_scope": "all",
        "is_sale_period": False,
        "sale_text":      "",
        "is_free_weekend": False,
        "content":        content,
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
