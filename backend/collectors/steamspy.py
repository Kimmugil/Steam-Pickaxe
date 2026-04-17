"""
SteamSpy API — 보조 지표 수집 (추정치)
"""
import requests
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import STEAMSPY_ENDPOINT


def fetch_steamspy_data(appid: str) -> dict:
    try:
        r = requests.get(
            STEAMSPY_ENDPOINT,
            params={"request": "appdetails", "appid": appid},
            timeout=20,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[steamspy] 오류 appid={appid}: {e}")
        return {}


def parse_steamspy_meta(data: dict) -> dict:
    """games 탭에 저장할 SteamSpy 파생 지표"""
    owners_raw = data.get("owners", "0 .. 0")
    try:
        low, high = [int(x.strip().replace(",", "")) for x in owners_raw.split("..")]
        owners_estimate = (low + high) // 2
    except Exception:
        owners_estimate = 0

    return {
        "owners_estimate": owners_estimate,
        "avg_playtime": data.get("average_forever", 0),
        "median_playtime": data.get("median_forever", 0),
        "active_players_2weeks": data.get("average_2weeks", 0),
    }
