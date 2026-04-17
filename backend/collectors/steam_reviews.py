"""
Steam Reviews API — 커서 기반 전체 리뷰 수집
기획서 3.A 사양: num_per_page=80 고정, 커서 루프 버그 대응
"""
import requests
import time
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import STEAM_REVIEWS_ENDPOINT, REVIEWS_PER_PAGE, STEAM_API_KEY

MAX_RETRIES = 3
RETRY_DELAY = 5


def fetch_reviews_page(appid: str, cursor: str = "*", language: str = "all") -> dict | None:
    params = {
        "json": 1,
        "filter": "recent",
        "language": language,
        "purchase_type": "all",
        "num_per_page": REVIEWS_PER_PAGE,
        "cursor": cursor,
    }
    if STEAM_API_KEY:
        params["key"] = STEAM_API_KEY

    url = STEAM_REVIEWS_ENDPOINT.format(appid=appid)
    for attempt in range(MAX_RETRIES):
        try:
            r = requests.get(url, params=params, timeout=30)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            print(f"[reviews] 시도 {attempt+1}/{MAX_RETRIES} 실패: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY * (attempt + 1))
    return None


def collect_reviews_batch(appid: str, last_cursor: str, max_pages: int = None) -> tuple[list[dict], str, int]:
    """
    Returns: (reviews, next_cursor, total_count)
    next_cursor가 last_cursor와 동일하면 수집 완료
    """
    cursor = last_cursor or "*"
    all_reviews = []
    page_count = 0
    total_count = 0

    while True:
        data = fetch_reviews_page(appid, cursor)
        if not data or data.get("success") != 1:
            print(f"[reviews] appid={appid} 응답 실패, 현재 커서={cursor} 저장")
            break

        total_count = data.get("query_summary", {}).get("total_reviews", total_count)
        reviews = data.get("reviews", [])
        new_cursor = data.get("cursor", cursor)

        if not reviews or new_cursor == cursor:
            cursor = new_cursor
            print(f"[reviews] appid={appid} 수집 완료 (동일 커서 감지)")
            break

        all_reviews.extend(reviews)
        cursor = new_cursor
        page_count += 1
        print(f"[reviews] appid={appid} {page_count}페이지 수집, 누적 {len(all_reviews)}건")

        if max_pages and page_count >= max_pages:
            print(f"[reviews] appid={appid} 최대 페이지({max_pages}) 도달, 중단")
            break

        time.sleep(0.5)

    return all_reviews, cursor, total_count


def get_total_review_count(appid: str) -> int:
    data = fetch_reviews_page(appid, "*")
    if data:
        return data.get("query_summary", {}).get("total_reviews", 0)
    return 0
