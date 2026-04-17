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

    return {
        "appid": str(appid),
        "name": app_data.get("name", ""),
        "name_kr": app_data.get("name", ""),
        "thumbnail": app_data.get("header_image", ""),
        "is_free": app_data.get("is_free", False),
        "is_early_access": "Early Access" in [g.get("description", "") for g in app_data.get("genres", [])],
        "metacritic_score": metacritic.get("score", ""),
        "release_date": release.get("date", ""),
    }
