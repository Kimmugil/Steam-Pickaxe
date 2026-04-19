"""
Steam appdetails API + 스토어 페이지 스크래핑 — 게임 메타데이터 수집

변경 이력:
  - _scrape_store_page: 실제 HTML 구조 기반으로 셀렉터 전면 재작성
      • #genresAndManufacturer .dev_row > <b> 방식으로 dev/pub 추출
      • 장르: #genresAndManufacturer a[href*='/genre/'] (공식 장르)
      • 가격: data-price-final 속성값(cents) 우선 활용
  - parse_game_meta: 스크래핑이 primary, API가 fallback으로 역할 전환
      • 이전: API 데이터가 비어있을 때만 스크래핑 (폴백)
      • 이후: 항상 스크래핑 → API로 보완 (신규/신작 게임 API 공백 대응)
"""
import requests
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
    Steam 스토어 페이지에서 genres / developer / publisher / price 스크래핑.
    실제 HTML 구조 기반 (2024년 이후 Steam 스토어):
      - #genresAndManufacturer  : 장르·개발사·배급사
      - .game_purchase_price[data-price-final] : 가격 (cents 단위)
    """
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        print("[steam_meta] beautifulsoup4 미설치 — 스크래핑 생략")
        return {}

    url = f"https://store.steampowered.com/app/{appid}/"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    # 성인 인증 + 나이 제한 우회 쿠키
    cookies = {
        "birthtime":       "470649600",       # 1984-11-01
        "mature_content":  "1",
        "lastagecheckage": "1-November-1984",
        "wants_mature_content": "1",
    }

    try:
        r = requests.get(url, headers=headers, cookies=cookies, timeout=20, allow_redirects=True)
        r.raise_for_status()
    except Exception as e:
        print(f"[steam_meta] 스토어 페이지 스크래핑 실패 appid={appid}: {e}")
        return {}

    soup = BeautifulSoup(r.text, "html.parser")
    result: dict = {}

    # ── Developer / Publisher ─────────────────────────────────────
    # 우선순위 1: #genresAndManufacturer 블록의 .dev_row (2024년 Steam 표준)
    #   <div class="dev_row"><b>Developer:</b> <a>Name</a></div>
    developer = ""
    publisher = ""

    gam = soup.select_one("#genresAndManufacturer")
    if gam:
        for row in gam.select(".dev_row"):
            b_tag = row.select_one("b")
            if not b_tag:
                continue
            label = b_tag.get_text(strip=True).lower().rstrip(":")
            links = row.select("a")
            val = ",".join(a.get_text(strip=True) for a in links if a.get_text(strip=True))
            if not val:
                # <a> 없으면 b 이후 텍스트
                val = b_tag.next_sibling
                val = val.strip() if isinstance(val, str) else ""
            if "developer" in label and not developer:
                developer = val
            elif "publisher" in label and not publisher:
                publisher = val

    # 우선순위 2: 헤더 영역 .dev_row (.subtitle.column / .summary.column 방식)
    if not developer or not publisher:
        for row in soup.select(".dev_row"):
            label_el = row.select_one(".subtitle.column") or row.select_one(".subtitle")
            val_el   = row.select_one(".summary.column")  or row.select_one(".summary")
            if not label_el or not val_el:
                continue
            label = label_el.get_text(strip=True).lower().rstrip(":")
            links = val_el.select("a")
            val = ",".join(a.get_text(strip=True) for a in links if a.get_text(strip=True))
            if not val:
                val = val_el.get_text(strip=True)
            if "developer" in label and not developer:
                developer = val
            elif "publisher" in label and not publisher:
                publisher = val

    if developer:
        result["developer"] = developer
    if publisher:
        result["publisher"] = publisher

    # ── Genres ───────────────────────────────────────────────────
    # 우선순위 1: #genresAndManufacturer 공식 장르 링크
    genres = ""
    if gam:
        genre_links = [
            a for a in gam.select("a")
            if "/genre/" in (a.get("href") or "")
        ]
        if genre_links:
            genres = ",".join(a.get_text(strip=True) for a in genre_links[:5])

    # 우선순위 2: popular user tags (.glance_tags.popular_tags .app_tag)
    if not genres:
        tag_els = [
            a for a in soup.select(".glance_tags.popular_tags .app_tag")
            if "add_button" not in (a.get("class") or [])
        ]
        if tag_els:
            genres = ",".join(a.get_text(strip=True) for a in tag_els[:5])

    if genres:
        result["genres"] = genres

    # ── Price ─────────────────────────────────────────────────────
    price = ""

    # 우선순위 1: data-price-final 속성 (cents 단위 정수)
    price_el = soup.select_one(".game_purchase_price[data-price-final]")
    if price_el:
        raw = price_el.get("data-price-final", "")
        try:
            cents = int(raw)
            if cents == 0:
                price = "Free to Play"
            else:
                price = f"${cents / 100:.2f}"
        except (ValueError, TypeError):
            price = price_el.get_text(strip=True)

    # 우선순위 2: 할인 적용 최종가
    if not price:
        el = soup.select_one(".discount_final_price")
        if el:
            price = el.get_text(strip=True)

    # 우선순위 3: 텍스트 그대로
    if not price:
        el = soup.select_one(".game_purchase_price")
        if el:
            price = el.get_text(strip=True)

    if price.strip().lower() in ("free to play", "free", "play for free!"):
        price = "무료"
    if price:
        result["price"] = price

    if result:
        print(f"[steam_meta] 스크래핑 성공 appid={appid}: {result}")
    else:
        print(f"[steam_meta] 스크래핑: 결과 없음 appid={appid}")
    return result


def is_game_type(app_data: dict) -> bool:
    return app_data.get("type") == "game"


def parse_game_meta(appid: str, app_data: dict) -> dict:
    """
    games 탭에 저장할 메타데이터 파싱.

    스크래핑이 primary, API가 fallback:
      - name / thumbnail / is_free / metacritic / release_date : API (신뢰도 높음)
      - genres / developer / publisher / price                  : 스크래핑 → 없으면 API
    """
    price_overview = app_data.get("price_overview", {})
    metacritic     = app_data.get("metacritic", {})
    release        = app_data.get("release_date", {})
    is_free        = app_data.get("is_free", False)

    api_genres_raw    = [g.get("description", "") for g in app_data.get("genres", []) if g.get("description")]
    is_early_access   = "Early Access" in api_genres_raw
    api_genres        = [g for g in api_genres_raw if g != "Early Access"]
    api_developers    = app_data.get("developers", [])
    api_publishers    = app_data.get("publishers", [])

    if is_free:
        api_price = "무료"
    elif price_overview:
        api_price = price_overview.get("final_formatted", "")
    else:
        api_price = ""

    # ── 스크래핑 (always, primary) ────────────────────────────────
    print(f"[steam_meta] 스토어 페이지 스크래핑 시도 appid={appid}")
    scraped = _scrape_store_page(appid)

    # 스크래핑 우선, 없으면 API
    genres    = scraped.get("genres")    or (",".join(api_genres[:4])     if api_genres     else "")
    developer = scraped.get("developer") or (",".join(api_developers[:2]) if api_developers else "")
    publisher = scraped.get("publisher") or (",".join(api_publishers[:2]) if api_publishers else "")
    price     = scraped.get("price")     or api_price

    return {
        "appid":            str(appid),
        "name":             app_data.get("name", ""),
        "name_kr":          app_data.get("name", ""),
        "thumbnail":        app_data.get("header_image", ""),
        "is_free":          is_free,
        "is_early_access":  is_early_access,
        "metacritic_score": metacritic.get("score", ""),
        "release_date":     release.get("date", ""),
        "genres":           genres,
        "developer":        developer,
        "publisher":        publisher,
        "price":            price,
    }
