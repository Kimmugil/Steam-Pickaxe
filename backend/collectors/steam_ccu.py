"""
Steam CCU API — 동시접속자 수 수집 (1시간 주기)
기획서 3.C: ISteamUserStats/GetNumberOfCurrentPlayers/
"""
import requests
from datetime import datetime, timezone
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import STEAM_CCU_ENDPOINT, STEAM_API_KEY


def fetch_current_ccu(appid: str) -> int | None:
    params = {"appid": appid}
    if STEAM_API_KEY:
        params["key"] = STEAM_API_KEY
    try:
        r = requests.get(STEAM_CCU_ENDPOINT, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        result = data.get("response", {})
        if result.get("result") == 1:
            return result.get("player_count", 0)
    except Exception as e:
        print(f"[steam_ccu] 오류 appid={appid}: {e}")
    return None


def now_utc_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_peak_ccu(appid: str) -> int:
    """appdetails에서 역대 최고 CCU 수집"""
    try:
        r = requests.get(
            "https://store.steampowered.com/api/appdetails",
            params={"appids": appid, "filters": "achievements"},
            timeout=15,
        )
        # Steam은 peak_ccu를 appdetails에 직접 내려주지 않으므로
        # SteamSpy peak_ccu 필드를 사용
        r2 = requests.get(
            "https://steamspy.com/api.php",
            params={"request": "appdetails", "appid": appid},
            timeout=20,
        )
        r2.raise_for_status()
        return int(r2.json().get("peak_ccu", 0))
    except Exception:
        return 0
