"""
스팀곡괭이 — Steam 리뷰 수집 모듈
─────────────────────────────────────────────────────
cursor 기반 페이지네이션으로 Steam 리뷰 API를 호출합니다.
이 모듈의 함수들은 steam-review-bot에서도 import하여 사용할 수 있습니다.

주요 함수:
  collect_all_reviews()   - 특정 게임의 전체 신규 리뷰 수집
  fetch_reviews_page()    - 1페이지 단위 API 호출 (저수준)
  fetch_game_info()       - 게임 기본 정보 조회
"""

import time
import requests
from typing import Optional

# ─────────────────────────────────────────────
#  Steam API 엔드포인트
# ─────────────────────────────────────────────
REVIEW_API_URL   = "https://store.steampowered.com/appreviews/{appid}"
APP_DETAILS_URL  = "https://store.steampowered.com/api/appdetails"
SEARCH_URL       = "https://store.steampowered.com/api/storesearch/"
NEWS_API_URL     = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/"

DEFAULT_TIMEOUT  = 15   # 초
DEFAULT_DELAY    = 0.35  # 요청 간 대기 (Steam API 과부하 방지)


# ─────────────────────────────────────────────
#  게임 정보 조회
# ─────────────────────────────────────────────
def fetch_game_info(appid: int) -> Optional[dict]:
    """
    Steam Store API에서 게임 기본 정보를 가져옵니다.

    Returns:
        {
            "appid": int,
            "name": str,
            "release_date": str,
            "developer": str,
            "publisher": str,
            "header_image": str,
            "short_description": str,
        }
        또는 None (조회 실패 시)
    """
    try:
        resp = requests.get(
            APP_DETAILS_URL,
            params={"appids": appid, "cc": "kr", "l": "koreana"},
            timeout=DEFAULT_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json().get(str(appid), {})
        if not data.get("success"):
            return None
        d = data["data"]
        return {
            "appid": appid,
            "name": d.get("name", ""),
            "release_date": d.get("release_date", {}).get("date", ""),
            "developer": ", ".join(d.get("developers", [])),
            "publisher": ", ".join(d.get("publishers", [])),
            "header_image": d.get("header_image", ""),
            "short_description": d.get("short_description", ""),
        }
    except Exception:
        return None


def search_games(query: str, limit: int = 10) -> list[dict]:
    """
    Steam Store 검색 API로 게임을 검색합니다.

    Returns:
        검색 결과 게임 리스트 (각 dict에 appid, name, tiny_image 포함)
    """
    try:
        resp = requests.get(
            SEARCH_URL,
            params={"term": query, "l": "korean", "cc": "KR"},
            timeout=DEFAULT_TIMEOUT,
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])
        results = []
        for item in items[:limit]:
            results.append({
                "appid": item.get("id"),
                "name": item.get("name", ""),
                "tiny_image": item.get("tiny_image", ""),
                "metascore": item.get("metascore", ""),
                "platforms": item.get("platforms", {}),
            })
        return results
    except Exception:
        return []


def fetch_review_summary(appid: int) -> dict:
    """
    Steam 리뷰 요약 통계를 가져옵니다 (총 리뷰 수, 현재 평가 등).

    Returns:
        {
            "total_reviews": int,
            "total_positive": int,
            "total_negative": int,
            "review_score": int,       # 1~9 (Steam 평가 등급)
            "review_score_desc": str,  # "압도적으로 긍정적" 등
        }
    """
    try:
        resp = requests.get(
            REVIEW_API_URL.format(appid=appid),
            params={"json": 1, "num_per_page": 0, "language": "all"},
            timeout=DEFAULT_TIMEOUT,
        )
        resp.raise_for_status()
        summary = resp.json().get("query_summary", {})
        return {
            "total_reviews":   summary.get("total_reviews", 0),
            "total_positive":  summary.get("total_positive", 0),
            "total_negative":  summary.get("total_negative", 0),
            "review_score":    summary.get("review_score", 0),
            "review_score_desc": summary.get("review_score_desc", ""),
        }
    except Exception:
        return {}


# ─────────────────────────────────────────────
#  리뷰 수집 (핵심 함수)
# ─────────────────────────────────────────────
def fetch_reviews_page(
    appid: int,
    cursor: str = "*",
    language: str = "all",
    count: int = 100,
    filter_type: str = "recent",
) -> tuple[list[dict], str]:
    """
    Steam 리뷰 API를 1페이지 호출합니다.

    Args:
        appid: Steam App ID
        cursor: 페이지네이션 cursor ("*"이면 첫 페이지)
        language: "all" 또는 Steam 언어 코드 (예: "koreana", "english")
        count: 페이지당 리뷰 수 (최대 100)
        filter_type: "recent" (최신순) 또는 "all"

    Returns:
        (리뷰 리스트, 다음 cursor)
        다음 cursor가 현재와 같으면 마지막 페이지
    """
    params = {
        "json":          1,
        "filter":        filter_type,
        "language":      language,
        "cursor":        cursor,
        "num_per_page":  count,
        "review_type":   "all",
        "purchase_type": "all",
    }
    try:
        resp = requests.get(
            REVIEW_API_URL.format(appid=appid),
            params=params,
            timeout=DEFAULT_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()

        if not data.get("success"):
            return [], cursor

        reviews     = data.get("reviews", [])
        next_cursor = data.get("cursor", cursor)
        return reviews, next_cursor

    except requests.exceptions.Timeout:
        print(f"  ⏱ 타임아웃 — appid={appid}, cursor={cursor[:20]}")
        return [], cursor
    except Exception as e:
        print(f"  ❌ API 오류 — {e}")
        return [], cursor


def collect_all_reviews(
    appid: int,
    last_cursor: str = "*",
    max_pages: int = 500,
    delay: float = DEFAULT_DELAY,
    language: str = "all",
    on_progress=None,
) -> tuple[list[dict], str]:
    """
    last_cursor 이후의 모든 신규 리뷰를 수집합니다.
    GitHub Actions 스팀곡괭이 및 Streamlit 분석 화면 모두에서 사용합니다.

    Args:
        appid: Steam App ID
        last_cursor: 마지막으로 저장된 cursor ("*"이면 전체 수집)
        max_pages: 최대 페이지 수 (무한루프 방지)
        delay: 요청 간 대기시간(초)
        language: 언어 필터 ("all"이면 전체)
        on_progress: 진행 상황 콜백 함수 on_progress(page, total_collected)
                     Streamlit의 progress bar 연동에 활용

    Returns:
        (수집된 리뷰 리스트, 이번 수집의 마지막 cursor)
    """
    all_reviews: list[dict] = []
    cursor = last_cursor

    for page in range(1, max_pages + 1):
        reviews, next_cursor = fetch_reviews_page(
            appid, cursor=cursor, language=language
        )

        if not reviews:
            # 더 이상 리뷰 없음
            break

        all_reviews.extend(reviews)

        if next_cursor == cursor:
            # cursor가 바뀌지 않으면 마지막 페이지
            break

        cursor = next_cursor

        if on_progress:
            on_progress(page, len(all_reviews))

        if page % 20 == 0:
            print(f"    [{appid}] {page}p 완료, 누적 {len(all_reviews):,}건...")

        time.sleep(delay)

    return all_reviews, cursor


def collect_reviews_since(
    appid: int,
    since_timestamp: int,
    last_cursor: str = "*",
    max_pages: int = 200,
    delay: float = DEFAULT_DELAY,
) -> tuple[list[dict], str]:
    """
    특정 timestamp 이후의 리뷰만 수집합니다.
    이미 아카이브된 게임의 증분 업데이트에 활용합니다.

    Args:
        since_timestamp: 이 Unix timestamp 이후 리뷰만 수집

    Returns:
        (새 리뷰 리스트, 마지막 cursor)
    """
    all_reviews: list[dict] = []
    cursor = last_cursor

    for page in range(1, max_pages + 1):
        reviews, next_cursor = fetch_reviews_page(appid, cursor=cursor)

        if not reviews:
            break

        # timestamp 기준 필터링
        new_reviews = [
            r for r in reviews
            if r.get("timestamp_created", 0) > since_timestamp
        ]

        all_reviews.extend(new_reviews)

        # 모든 리뷰가 since_timestamp 이전이면 중단 (최신순 정렬 활용)
        if len(new_reviews) < len(reviews):
            break

        if next_cursor == cursor:
            break

        cursor = next_cursor
        time.sleep(delay)

    return all_reviews, cursor


# ─────────────────────────────────────────────
#  스팀 뉴스 (이벤트 탐지용)
# ─────────────────────────────────────────────
def fetch_steam_news(appid: int, count: int = 500) -> list[dict]:
    """
    Steam News API에서 공식 패치노트/공지를 가져옵니다.
    최대 500건까지 가져와 전체 기간 타임라인 생성에 활용합니다.

    Returns:
        뉴스 항목 리스트 [{title, url, date, contents}, ...] (날짜 오름차순)
    """
    all_items: list[dict] = []
    try:
        resp = requests.get(
            NEWS_API_URL,
            params={
                "appid":     appid,
                "count":     count,
                "maxlength": 300,
                "format":    "json",
            },
            timeout=DEFAULT_TIMEOUT,
        )
        resp.raise_for_status()
        raw = resp.json().get("appnews", {}).get("newsitems", [])
        for item in raw:
            # feedname/feedlabel 기반으로 공식 공지/패치노트만 포함
            feedlabel = item.get("feedlabel", "").lower()
            feedname  = item.get("feedname",  "").lower()
            is_official = any(k in feedlabel or k in feedname for k in
                              ("patch", "update", "announce", "news", "official",
                               "steam", "store.steampowered"))
            all_items.append({
                "title":     item.get("title", ""),
                "url":       item.get("url", ""),
                "date":      item.get("date", 0),
                "contents":  (item.get("contents") or "")[:300],
                "feedlabel": item.get("feedlabel", ""),
                "is_official": is_official,
            })
    except Exception:
        return []

    # 날짜 오름차순 (오래된 것 먼저 — 타임라인 생성에 적합)
    all_items.sort(key=lambda x: int(x.get("date") or 0))
    return all_items
