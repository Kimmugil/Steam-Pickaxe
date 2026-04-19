"""
Steam appdetails API — 게임 메타데이터 수집
"""
import requests
import time
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import STEAM_APPDETAILS_ENDPOINT


def fetch_app_details(appid: str) -> dict | None:
    """None 반환 시 유효하지 않은 AppID"""
    try:
        r = requests.get(
            STEAM_APPDETAILS_ENDPOINT,
            params={"appids": appid, "cc": "us", "l": "english"},
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        info = data.get(str(appid), {})
        if not info.get("success"):
            return None
        return info.get("data", {})
    except Exception as e:
        print(f"[steam_meta] appdetails 오류 appid={appid}: {e}")
        return None


def _scrape_store_page(appid: str) -> dict:
    """
    Steam 스토어 페이지에서 genres/developer/publisher/price 스크래핑.
    appdetails API가 해당 필드를 비워 반환할 때 폴백으로 사용.
    """
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        print("[steam_meta] beautifulsoup4 미설치 — 스크래핑 생략")
        return {}

    url = f"https://store.steampowered.com/app/{appid}/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }
    cookies = {"birthtime": "0", "lastagecheckage": "1-0-1990", "mature_content": "1"}

    try:
        r = requests.get(url, headers=headers, cookies=cookies, timeout=15)
        r.raise_for_status()
    except Exception as e:
        print(f"[steam_meta] 스토어 페이지 스크래핑 실패 appid={appid}: {e}")
        return {}

    soup = BeautifulSoup(r.text, "html.parser")
    result: dict = {}

    # ── Developer / Publisher ────────────────────────────────
    dev_rows = soup.select(".dev_row")
    for row in dev_rows:
        label_el = row.select_one(".subtitle.column")
        val_el    = row.select_one(".summary.column")
        if not label_el or not val_el:
            continue
        label = label_el.get_text(strip=True).lower()
        names = [a.get_text(strip=True) for a in val_el.select("a")]
        if not names:
            names = [val_el.get_text(strip=True)]
        if "developer" in label:
            result["developer"] = ",".join(names[:2])
        elif "publisher" in label:
            result["publisher"] = ",".join(names[:2])

    # ── Genres (popular tags 우선, 없으면 상세 블록) ─────────
    tags = [a.get_text(strip=True) for a in soup.select(".glance_tags.popular_tags a")]
    if tags:
        # popular tags는 많을 수 있으니 상위 5개만
        result["genres"] = ",".join(tags[:5])
    else:
        genre_links = soup.select(".details_block a[href*='/genre/']")
        if genre_links:
            result["genres"] = ",".join(g.get_text(strip=True) for g in genre_links[:4])

    # ── Price ────────────────────────────────────────────────
    price_el = soup.select_one(".game_purchase_price.price")
    if price_el:
        price_text = price_el.get_text(strip=True)
        if price_text:
            result["price"] = price_text
    else:
        # 할인 중인 경우 최종 가격
        discount_el = soup.select_one(".discount_final_price")
        if discount_el:
            result["price"] = discount_el.get_text(strip=True)

    if result:
        print(f"[steam_meta] 스토어 페이지 스크래핑 성공: {result}")
    return result


def is_game_type(app_data: dict) -> bool:
    return app_data.get("type") == "game"


def parse_game_meta(appid: str, app_data: dict) -> dict:
    """games 탭에 저장할 메타데이터 파싱"""
    price_overview = app_data.get("price_overview", {})
    metacritic = app_data.get("metacritic", {})
    release = app_data.get("release_date", {})
    is_free = app_data.get("is_free", False)

    genres_raw = [g.get("description", "") for g in app_data.get("genres", []) if g.get("description")]
    is_early_access = "Early Access" in genres_raw
    # Early Access는 장르가 아니므로 표시 목록에서 제외
    genres = [g for g in genres_raw if g != "Early Access"]

    developers = app_data.get("developers", [])
    publishers = app_data.get("publishers", [])

    if is_free:
        price = "무료"
    elif price_overview:
        price = price_overview.get("final_formatted", "")
    else:
        price = ""

    # ── 스크래핑 폴백 ────────────────────────────────────────
    # API가 genres/developer/publisher/price를 비워 반환하는 경우
    # (일부 게임에서 발생) 스토어 페이지 스크래핑으로 보완
    needs_scrape = (not genres) or (not developers) or (not publishers) or (not price)
    scraped: dict = {}
    if needs_scrape:
        print(f"[steam_meta] API 데이터 불완전 — 스토어 페이지 스크래핑 시도 (appid={appid})")
        scraped = _scrape_store_page(appid)

    return {
        "appid": str(appid),
        "name": app_data.get("name", ""),
        "name_kr": app_data.get("name", ""),
        "thumbnail": app_data.get("header_image", ""),
        "is_free": is_free,
        "is_early_access": is_early_access,
        "metacritic_score": metacritic.get("score", ""),
        "release_date": release.get("date", ""),
        # 신규 필드 — API 우선, 없으면 스크래핑 결과
        "genres": ",".join(genres[:4]) if genres else scraped.get("genres", ""),
        "developer": ",".join(developers[:2]) if developers else scraped.get("developer", ""),
        "publisher": ",".join(publishers[:2]) if publishers else scraped.get("publisher", ""),
        "price": price if price else scraped.get("price", ""),
    }
