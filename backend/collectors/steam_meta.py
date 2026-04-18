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

    return {
        "appid": str(appid),
        "name": app_data.get("name", ""),
        "name_kr": app_data.get("name", ""),
        "thumbnail": app_data.get("header_image", ""),
        "is_free": is_free,
        "is_early_access": is_early_access,
        "metacritic_score": metacritic.get("score", ""),
        "release_date": release.get("date", ""),
        # 신규 필드
        "genres": ",".join(genres[:4]),
        "developer": ",".join(developers[:2]),
        "publisher": ",".join(publishers[:2]),
        "price": price,
    }
