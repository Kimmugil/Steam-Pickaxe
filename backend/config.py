import os
import json
from dotenv import load_dotenv

load_dotenv()

def get_google_creds():
    raw = os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"]
    return json.loads(raw)

MASTER_SPREADSHEET_ID = os.environ.get("MASTER_SPREADSHEET_ID", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
STEAM_API_KEY = os.environ.get("STEAM_API_KEY", "")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "Kimmugil/Steam-Pickaxe")

# Google Apps Script 웹앱 URL
# 역할: 서비스 계정 대신 관리자 계정으로 RAW 스프레드시트를 생성해 줌
# 설정 방법: gas/DEPLOY_GUIDE.md 참조
GAS_WEBAPP_URL = os.environ.get("GAS_WEBAPP_URL", "")

STEAM_REVIEWS_ENDPOINT = "https://store.steampowered.com/appreviews/{appid}"
STEAM_NEWS_ENDPOINT = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/"
STEAM_CCU_ENDPOINT = "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/"
STEAM_APPDETAILS_ENDPOINT = "https://store.steampowered.com/api/appdetails"
STEAMSPY_ENDPOINT = "https://steamspy.com/api.php"

REVIEWS_PER_PAGE = 80
MAX_REVIEWS_PER_ANALYSIS = 2000
ANALYSIS_TOP_VOTES = 1000
ANALYSIS_LATEST = 1000
CCU_COLLECT_INTERVAL_HOURS = 1
