import streamlit as st
import plotly.graph_objects as go
from datetime import datetime
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

# ── src 모듈 임포트 (Secrets 미설정 상태에서도 앱은 정상 실행됨) ──
try:
    from src.config import is_sheets_configured
    from src.sheets_manager import (
        get_client as _get_sheets_client,
        get_game_info as _sheets_get_game_info,
        register_game as _sheets_register_game,
        get_all_tracked_games as _sheets_get_all_games,
        save_reviews as _sheets_save_reviews,
        load_reviews as _sheets_load_reviews,
        load_timeline_events as _sheets_load_timeline,
        save_timeline_events as _sheets_save_timeline,
        save_timeline_version as _sheets_save_tl_version,
        load_timeline_versions as _sheets_load_tl_versions,
    )
    from src.steam_pickaxe import collect_all_reviews as _steam_collect, fetch_steam_news as _steam_news
    from src.gemini_analyzer import analyze_reviews_to_timeline as _gemini_analyze, EVENT_COLORS as _EVENT_COLORS
    _SHEETS_IMPORTABLE = True
except Exception:
    _SHEETS_IMPORTABLE = False
    _EVENT_COLORS = {}


@st.cache_resource(show_spinner=False)
def get_sheets_client():
    """Google Sheets 클라이언트 (앱 전체에서 1회만 인증)."""
    if not _SHEETS_IMPORTABLE:
        return None
    try:
        return _get_sheets_client()
    except Exception:
        return None


def sheets_ready() -> bool:
    """Sheets 연결이 가능한 상태인지 확인합니다."""
    if not _SHEETS_IMPORTABLE:
        return False
    try:
        return is_sheets_configured() and get_sheets_client() is not None
    except Exception:
        return False

# ─────────────────────────────────────────────
#  PAGE CONFIG
# ─────────────────────────────────────────────
st.set_page_config(
    page_title="리뷰 속에 답이 있다 | 스팀탈곡기 mk2",
    page_icon="⚙️",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ─────────────────────────────────────────────
#  CSS
# ─────────────────────────────────────────────
def inject_css():
    st.markdown("""<style>
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
html,body,[class*="css"]{font-family:'Pretendard Variable','Pretendard',-apple-system,BlinkMacSystemFont,system-ui,sans-serif!important;}
.stApp{background-color:#F4F5F7!important;}
section[data-testid="stSidebar"]{display:none!important;}
.block-container{padding:2.5rem 2.5rem 5rem 2.5rem!important;max-width:1280px!important;}
#MainMenu,footer,header{visibility:hidden!important;}
.stTextInput>div>div>input{border:1.5px solid #1E1E1E!important;border-radius:16px!important;background:#FFFFFF!important;padding:14px 20px!important;font-size:16px!important;color:#1E1E1E!important;box-shadow:none!important;transition:border-color 0.2s!important;}
.stTextInput>div>div>input:focus{border-color:#6DC2FF!important;box-shadow:none!important;}
.stTextInput>label{display:none!important;}
.stButton>button{border:1.5px solid #1E1E1E!important;border-radius:12px!important;background:#FFFFFF!important;color:#1E1E1E!important;font-weight:600!important;font-size:13px!important;padding:10px 16px!important;box-shadow:none!important;width:100%!important;transition:all 0.15s!important;word-break:keep-all!important;}
.stButton>button:hover{background:#1E1E1E!important;color:#FFFFFF!important;}
.stButton>button:active{transform:scale(0.98)!important;}
div[data-testid="column"]{padding:0 6px!important;}
.stPlotlyChart{border:1.5px solid #1E1E1E!important;border-radius:20px!important;overflow:hidden!important;background:#FFFFFF!important;}
.stSelectbox>div>div{border:1.5px solid #1E1E1E!important;border-radius:12px!important;background:#FFFFFF!important;box-shadow:none!important;}
/* ── Selectbox / Multiselect 드롭다운 (portal 렌더링) ── */
[data-baseweb="popover"]{background:#FFFFFF!important;border:1.5px solid #1E1E1E!important;border-radius:12px!important;}
[data-baseweb="option"]{color:#1E1E1E!important;background:#FFFFFF!important;}
[data-baseweb="option"]:hover,[data-baseweb="option"][aria-selected="true"]{background:#F4F5F7!important;color:#1E1E1E!important;}
[data-baseweb="select"]>div{color:#1E1E1E!important;}
[data-baseweb="select"] span{color:#1E1E1E!important;}
[data-baseweb="menu"]{background:#FFFFFF!important;}
li[role="option"]{color:#1E1E1E!important;background:#FFFFFF!important;}
li[role="option"]:hover{background:#F4F5F7!important;}
/* ── Expander / Status ── */
details>summary{background:#F4F5F7!important;color:#1E1E1E!important;border-radius:12px!important;}
details{border:1.5px solid #1E1E1E!important;border-radius:16px!important;background:#FFFFFF!important;}
details p,details span,details li,details div{color:#1E1E1E!important;}
/* ── 모든 마크다운 텍스트 ── */
[data-testid="stMarkdownContainer"] p,[data-testid="stMarkdownContainer"] li{color:#1E1E1E!important;}
[data-testid="stMarkdownContainer"] span:not([style*="background"]){color:#1E1E1E!important;}
/* 어두운 배경 배지 텍스트 강제 화이트 */
[data-testid="stMarkdownContainer"] span[style*="background:#1E1E1E"]{color:#FFFFFF!important;}
/* 버튼 포커스 상태 */
.stButton>button:focus,.stButton>button:focus-visible{background:#FFFFFF!important;color:#1E1E1E!important;box-shadow:none!important;outline:none!important;}
.stButton>button:active{background:#1E1E1E!important;color:#FFFFFF!important;transform:scale(0.98)!important;}
/* ── Alert / Toast ── */
[data-testid="stAlert"] p,[data-testid="stAlert"] span{color:#1E1E1E!important;}
/* ── 툴팁 ── */
.tt{position:relative;display:inline-flex;align-items:center;cursor:default;}
.tt .ttb{display:none;position:absolute;bottom:130%;left:50%;transform:translateX(-50%);
  background:#1E1E1E;color:#FFFFFF;padding:8px 12px;border-radius:10px;font-size:11px;
  font-weight:400;line-height:1.65;white-space:normal;min-width:200px;max-width:280px;
  z-index:9999;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,0.25);}
.tt:hover .ttb{display:block;}
.tt-icon{font-size:10px;color:#AAAAAA;margin-left:4px;cursor:help;}
/* 라디오 버튼 */
div[data-testid="stRadio"]>div{display:flex;flex-wrap:wrap;gap:6px!important;}
div[data-testid="stRadio"] label{border:1.5px solid #1E1E1E!important;border-radius:10px!important;
  padding:5px 12px!important;background:#FFFFFF!important;cursor:pointer!important;font-size:12px!important;}
div[data-testid="stRadio"] label:has(input:checked){background:#1E1E1E!important;color:#FFFFFF!important;}
div[data-testid="stRadio"] label:has(input:checked) *{color:#FFFFFF!important;}
div[data-testid="stRadio"] label:has(input:checked) p{color:#FFFFFF!important;}
</style>""", unsafe_allow_html=True)


# ─────────────────────────────────────────────
#  STEAM API
# ─────────────────────────────────────────────
_STEAM_SEARCH  = "https://store.steampowered.com/api/storesearch/"
_STEAM_REVIEWS = "https://store.steampowered.com/appreviews/{appid}"
_STEAM_DETAILS = "https://store.steampowered.com/api/appdetails"


def _thumb(appid: int) -> str:
    return f"https://cdn.akamai.steamstatic.com/steam/apps/{appid}/header.jpg"


def _fetch_review_raw(appid: int) -> dict:
    """캐시 없는 리뷰 요약 조회. ThreadPoolExecutor 내부에서 호출됩니다."""
    try:
        r = requests.get(
            _STEAM_REVIEWS.format(appid=appid),
            params={
                "json": 1, "num_per_page": 0,
                "language": "all", "purchase_type": "all", "filter": "all",
            },
            timeout=6,
        )
        s = r.json().get("query_summary", {})
        total = s.get("total_reviews", 0)
        pos   = s.get("total_positive", 0)
        return {
            "total_reviews": total,
            "rating_pct":    round(pos / total * 100) if total else 0,
            "rating_label":  s.get("review_score_desc", ""),
        }
    except Exception:
        return {"total_reviews": 0, "rating_pct": 0, "rating_label": ""}


@st.cache_data(ttl=300, show_spinner=False)
def steam_search(query: str) -> list[dict]:
    """Steam Store 검색 + 각 게임 리뷰 요약 병렬 조회. 5분 캐시."""
    try:
        resp = requests.get(
            _STEAM_SEARCH,
            params={"term": query, "l": "korean", "cc": "KR"},
            timeout=8,
        )
        items = resp.json().get("items", [])[:8]
    except Exception:
        return []

    if not items:
        return []

    games = [
        {
            "appid":         item["id"],
            "name":          item["name"],
            "name_en":       item["name"],
            "thumbnail":     _thumb(item["id"]),
            "release_date":  "",
            "total_reviews": 0,
            "rating_pct":    0,
            "rating_label":  "",
            "last_analyzed": None,
        }
        for item in items
    ]

    # 리뷰 요약 병렬 조회 (순수 HTTP — Streamlit 컨텍스트 미사용)
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(_fetch_review_raw, g["appid"]): i for i, g in enumerate(games)}
        for fut in as_completed(futures):
            idx = futures[fut]
            try:
                games[idx].update(fut.result())
            except Exception:
                pass

    return games


@st.cache_data(ttl=600, show_spinner=False)
def steam_game_detail(appid: int) -> dict:
    """특정 게임의 상세정보 + 리뷰 요약. 10분 캐시."""
    result = {
        "appid":         appid,
        "name":          str(appid),
        "name_en":       str(appid),
        "thumbnail":     _thumb(appid),
        "release_date":  "",
        "total_reviews": 0,
        "rating_pct":    0,
        "rating_label":  "",
        "last_analyzed": None,
    }
    try:
        d = requests.get(
            _STEAM_DETAILS,
            params={"appids": appid, "cc": "kr", "l": "koreana"},
            timeout=8,
        ).json().get(str(appid), {})
        if d.get("success"):
            data = d["data"]
            result["name"]         = data.get("name", str(appid))
            result["name_en"]      = data.get("name", str(appid))
            result["release_date"] = data.get("release_date", {}).get("date", "")
            result["thumbnail"]    = data.get("header_image", _thumb(appid))
            # recommendations.total 이 가장 신뢰도 높은 전체 리뷰 수
            recs_total = data.get("recommendations", {}).get("total", 0)
            if recs_total:
                result["total_reviews"] = recs_total
    except Exception:
        pass
    # recommendations 없을 경우 review API 로 보완
    review_info = _fetch_review_raw(appid)
    if not result["total_reviews"]:
        result.update(review_info)
    else:
        result["rating_pct"]   = review_info.get("rating_pct", 0)
        result["rating_label"] = review_info.get("rating_label", "")
    return result


# ─────────────────────────────────────────────
#  UTILITY — 시트에서 타임라인 생성 게임 로드 & 언어 필터
# ─────────────────────────────────────────────
STEAM_LANG_KO = {
    "koreana":   "한국어",  "english":  "영어",    "schinese": "중국어 간체",
    "tchinese":  "중국어 번체", "japanese": "일본어", "russian":  "러시아어",
    "portuguese": "포르투갈어", "brazilian": "브라질 포르투갈어",
    "french":    "프랑스어",  "german":   "독일어",  "spanish":  "스페인어",
    "latam":     "스페인어(중남미)", "italian": "이탈리아어", "polish": "폴란드어",
    "dutch":     "네덜란드어", "thai":    "태국어",  "turkish":  "터키어",
    "vietnamese": "베트남어", "arabic":  "아랍어",  "indonesian": "인도네시아어",
    "hungarian": "헝가리어", "czech":   "체코어",   "romanian": "루마니아어",
    "swedish":   "스웨덴어", "norwegian": "노르웨이어", "ukrainian": "우크라이나어",
}


@st.cache_data(ttl=120, show_spinner=False)
def _load_analyzed_games() -> list[dict]:
    """시트에 타임라인이 생성된 active 게임 목록 (2분 캐시)."""
    if not sheets_ready():
        return []
    try:
        client = get_sheets_client()
        tracked = _sheets_get_all_games(client)
        result = []
        for g in tracked:
            if g.get("status") != "active":
                continue
            if int(g.get("total_archived") or 0) == 0:
                continue
            appid = int(g.get("appid", 0))
            if not appid:
                continue
            steam_info = steam_game_detail(appid)
            result.append({
                "appid":         appid,
                "name":          g.get("name", str(appid)),
                "name_en":       g.get("name_en", str(appid)),
                "thumbnail":     steam_info.get("thumbnail", _thumb(appid)),
                "release_date":  g.get("release_date", ""),
                "total_reviews": steam_info.get("total_reviews", int(g.get("total_archived") or 0)),
                "rating_pct":    steam_info.get("rating_pct", 0),
                "rating_label":  steam_info.get("rating_label", ""),
                "last_analyzed": g.get("last_pickaxe_run", ""),
            })
        return result
    except Exception:
        return []


@st.cache_data(ttl=300, show_spinner=False)
def _load_reviews_cached(appid: int) -> list[dict]:
    """언어별 민심 계산용 리뷰 로드 (5분 캐시, 최대 50,000건)."""
    if not sheets_ready():
        return []
    try:
        return _sheets_load_reviews(get_sheets_client(), appid)
    except Exception:
        return []


def _calc_events_lang_filter(
    events: list[dict], reviews: list[dict], lang_code: str
) -> list[dict]:
    """언어 필터 적용 이벤트 리스트 반환 (차트 전용, sentiment_pct/review_count 재계산)."""
    from datetime import datetime, timezone as _tz
    result = []
    for evt in events:
        date_start = evt.get("date", "")
        date_end   = evt.get("period_end", "")
        try:
            start_ts = int(datetime.fromisoformat(date_start + "T00:00:00+00:00").timestamp())
            end_ts   = int(datetime.fromisoformat(date_end   + "T23:59:59+00:00").timestamp())
        except Exception:
            result.append(evt)
            continue
        period = [
            r for r in reviews
            if start_ts <= int(r.get("timestamp_created") or 0) <= end_ts
            and r.get("language") == lang_code
        ]
        new_evt = dict(evt)
        if period:
            pos = sum(1 for r in period if str(r.get("voted_up", "")).lower() in ("true", "1"))
            new_evt["sentiment_pct"] = round(pos / len(period) * 100)
            new_evt["review_count"]  = len(period)
        else:
            new_evt["review_count"] = 0
        result.append(new_evt)
    return result


def _apply_actual_stats_to_events(events: list[dict], reviews: list[dict]) -> list[dict]:
    """
    시트에 쌓인 전체 리뷰를 기반으로 각 이벤트의 review_count·sentiment_pct를 실측치로 교체.
    해당 기간 리뷰가 없으면 review_count=0 (수집 전 기간임을 의미).
    """
    from datetime import datetime, timezone as _tz
    if not reviews:
        return events
    result = []
    for evt in events:
        date_start = evt.get("date", "")
        date_end   = evt.get("period_end", "")
        try:
            start_ts = int(datetime.fromisoformat(date_start + "T00:00:00+00:00").timestamp())
            end_ts   = int(datetime.fromisoformat(date_end   + "T23:59:59+00:00").timestamp())
        except Exception:
            result.append(evt)
            continue
        period = [
            r for r in reviews
            if start_ts <= int(r.get("timestamp_created") or 0) <= end_ts
        ]
        new_evt = dict(evt)
        new_evt["review_count_actual"] = len(period)  # 실측값 별도 보존
        if period:
            pos = sum(1 for r in period if str(r.get("voted_up", "")).lower() in ("true", "1"))
            new_evt["review_count"]  = len(period)
            new_evt["sentiment_pct"] = round(pos / len(period) * 100)
        else:
            new_evt["review_count"] = 0  # 수집된 리뷰 없음 (미수집 기간)
        result.append(new_evt)
    return result


def _tt(text: str, tip: str) -> str:
    """툴팁 HTML 래퍼 반환."""
    return (
        f'<span class="tt">{text}'
        f'<span class="ttb">{tip}</span></span>'
    )


# ─────────────────────────────────────────────
#  MOCK DATA (하위 호환 — 홈 화면은 시트 데이터 우선)
# ─────────────────────────────────────────────
ANALYZED_GAMES = [
    {
        "appid": 2161700,
        "name": "원스 휴먼",
        "name_en": "Once Human",
        "thumbnail": "https://cdn.akamai.steamstatic.com/steam/apps/2161700/header.jpg",
        "release_date": "2024-07-09",
        "total_reviews": 234521,
        "rating_pct": 52,
        "last_analyzed": "2026-04-06",
        "timeline_id": "2161700_A3X7K",
    },
    {
        "appid": 1623730,
        "name": "팰월드",
        "name_en": "Palworld",
        "thumbnail": "https://cdn.akamai.steamstatic.com/steam/apps/1623730/header.jpg",
        "release_date": "2024-01-19",
        "total_reviews": 612847,
        "rating_pct": 76,
        "last_analyzed": "2026-03-28",
        "timeline_id": "1623730_B2M4P",
    },
    {
        "appid": 553850,
        "name": "헬다이버즈 2",
        "name_en": "Helldivers 2",
        "thumbnail": "https://cdn.akamai.steamstatic.com/steam/apps/553850/header.jpg",
        "release_date": "2024-02-08",
        "total_reviews": 512384,
        "rating_pct": 84,
        "last_analyzed": "2026-04-01",
        "timeline_id": "553850_C9R2T",
    },
    {
        "appid": 1868140,
        "name": "데이브 더 다이버",
        "name_en": "Dave the Diver",
        "thumbnail": "https://cdn.akamai.steamstatic.com/steam/apps/1868140/header.jpg",
        "release_date": "2023-06-28",
        "total_reviews": 198432,
        "rating_pct": 97,
        "last_analyzed": "2026-03-15",
        "timeline_id": "1868140_D5W8Q",
    },
]

# 검색 결과에만 등장하는 게임 (아직 분석 미완료)
SEARCH_ONLY_GAMES = [
    {
        "appid": 1091500,
        "name": "사이버펑크 2077",
        "name_en": "Cyberpunk 2077",
        "thumbnail": "https://cdn.akamai.steamstatic.com/steam/apps/1091500/header.jpg",
        "release_date": "2020-12-10",
        "total_reviews": 802341,
        "rating_pct": 87,
        "last_analyzed": None,
    },
    {
        "appid": 1245620,
        "name": "엘든 링",
        "name_en": "Elden Ring",
        "thumbnail": "https://cdn.akamai.steamstatic.com/steam/apps/1245620/header.jpg",
        "release_date": "2022-02-25",
        "total_reviews": 756123,
        "rating_pct": 96,
        "last_analyzed": None,
    },
]

# ─────────────────────────────────────────────
#  MOCK DATA — 원스 휴먼 타임라인
# ─────────────────────────────────────────────
TIMELINE_ONCE_HUMAN = [
    {
        "id": "evt_001",
        "name": "스팀 정식 출시",
        "date": "2024-07-09",
        "period": "2024.07.09 ~ 2024.07.13",
        "type": "launch",
        "type_label": "출시",
        "sentiment_pct": 82,
        "review_count": 42350,
        "description": "기대작으로 주목받던 원스 휴먼이 스팀에 정식 출시되었습니다. 오픈 베타 당시의 인기를 이어 첫날부터 동시접속자 수십만 명을 기록하며 화제가 되었습니다.",
        "key_issues": ["서버 불안정", "한국어 미지원", "그래픽 호평", "기대 이상의 콘텐츠"],
        "top_langs": ["영어", "중국어 간체", "러시아어", "한국어"],
        "kr_summary": "서버가 터지는 와중에도 '기대 이상'이라는 반응 다수. 한국어 미지원에 대한 아쉬움은 있으나 전반적으로 매우 호의적인 분위기.",
        "color": "#82C29A",
        "user_edited": False,
    },
    {
        "id": "evt_002",
        "name": "서버 과부하 위기 & 긴급 점검 반복",
        "date": "2024-07-14",
        "period": "2024.07.14 ~ 2024.08.14",
        "type": "crisis",
        "type_label": "위기",
        "sentiment_pct": 51,
        "review_count": 28100,
        "description": "폭발적인 인기로 인한 서버 과부하가 심각해지면서 긴급 점검이 반복되었습니다. 접속 불가 상태가 수시간 지속되며 게임을 즐기지 못하는 유저들의 불만이 급증했습니다.",
        "key_issues": ["서버 접속 불가", "긴급 점검 반복", "환불 요청 급증", "개발사 소통 부재"],
        "top_langs": ["영어", "중국어 간체", "한국어", "러시아어"],
        "kr_summary": "접속도 못 하는데 무슨 리뷰냐는 분위기. 환불은 했지만 게임 자체는 기대된다는 이중적인 반응이 공존.",
        "color": "#FFD166",
        "user_edited": False,
    },
    {
        "id": "evt_003",
        "name": "시즌 1: 더 스텔라 저니 시작",
        "date": "2024-08-15",
        "period": "2024.08.15 ~ 2024.09.11",
        "type": "update",
        "type_label": "업데이트",
        "sentiment_pct": 73,
        "review_count": 31200,
        "description": "서버 안정화 이후 첫 번째 정식 시즌이 시작되었습니다. 새로운 맵, 스토리, 시즌 패스 등 대규모 콘텐츠가 추가되며 유저들의 호응을 받았습니다.",
        "key_issues": ["시즌 패스 가성비 논란", "신규 보스 호평", "최적화 개선", "한국어 부분 지원 시작"],
        "top_langs": ["영어", "중국어 간체", "한국어", "포르투갈어"],
        "kr_summary": "시즌패스 가격에 대한 불만은 있지만 콘텐츠 자체는 만족. '살아났다'는 분위기가 커뮤니티에 감돎.",
        "color": "#82C29A",
        "user_edited": False,
    },
    {
        "id": "evt_004",
        "name": "시즌 2: 논란의 유료화 정책 발표",
        "date": "2024-09-12",
        "period": "2024.09.12 ~ 2024.10.07",
        "type": "controversy",
        "type_label": "논란",
        "sentiment_pct": 29,
        "review_count": 67420,
        "description": "시즌 2와 함께 발표된 신규 유료화 정책이 커뮤니티의 강한 반발을 샀습니다. 기존 무료 콘텐츠가 유료로 전환되고, 계정 분리 정책 변경이 논란이 되었습니다.",
        "key_issues": ["무료→유료 콘텐츠 전환", "계정 분리 정책", "개발사 일방적 공지", "조직적 부정 리뷰"],
        "top_langs": ["영어", "중국어 간체", "한국어", "러시아어"],
        "kr_summary": "유저들이 분노하여 조직적으로 부정 리뷰를 남김. '배신당했다'는 표현이 리뷰에 가장 많이 등장.",
        "color": "#FF9F9F",
        "user_edited": True,
    },
    {
        "id": "evt_005",
        "name": "긴급 사과문 발표 & 정책 철회",
        "date": "2024-10-08",
        "period": "2024.10.08 ~ 2024.12.18",
        "type": "recovery",
        "type_label": "회복",
        "sentiment_pct": 55,
        "review_count": 22800,
        "description": "개발사가 공식 사과문을 발표하고 논란이 된 유료화 정책을 대부분 철회했습니다. 보상 아이템 지급과 함께 신뢰 회복을 위한 로드맵도 공개되었습니다.",
        "key_issues": ["정책 철회 긍정 반응", "보상 아이템 지급", "남은 불신", "지켜보겠다는 분위기"],
        "top_langs": ["영어", "중국어 간체", "한국어", "독일어"],
        "kr_summary": "화는 풀렸지만 신뢰 회복은 시간이 필요하다는 분위기. '잘못 인정한 건 칭찬'이라는 중립적 반응이 지배적.",
        "color": "#FFD166",
        "user_edited": False,
    },
    {
        "id": "evt_006",
        "name": "시즌 3: 대규모 게임플레이 개편",
        "date": "2024-12-19",
        "period": "2024.12.19 ~ 2025.03.26",
        "type": "update",
        "type_label": "업데이트",
        "sentiment_pct": 71,
        "review_count": 44300,
        "description": "시즌 2 논란을 딛고 대규모 게임플레이 개편이 이루어진 시즌 3이 출시되었습니다. 전투 시스템 전면 개편, 신규 직업군 추가, UI/UX 개선 등이 호평받았습니다.",
        "key_issues": ["전투 시스템 개편 호평", "UI 개선 긍정", "신규 직업 인기", "일부 구 콘텐츠 삭제 아쉬움"],
        "top_langs": ["영어", "중국어 간체", "한국어", "프랑스어"],
        "kr_summary": "완전히 다른 게임이 됐다는 평가. 시즌2 사태를 기억하는 유저들도 '이 정도면 다시 해볼만'이라는 반응.",
        "color": "#82C29A",
        "user_edited": False,
    },
    {
        "id": "evt_007",
        "name": "시즌 4: 신규 지역 & 엔드게임 콘텐츠",
        "date": "2025-03-27",
        "period": "2025.03.27 ~ 현재",
        "type": "update",
        "type_label": "업데이트",
        "sentiment_pct": 81,
        "review_count": 38200,
        "description": "현재 진행 중인 시즌 4에서는 완전히 새로운 지역과 엔드게임 콘텐츠가 추가되었습니다. 한국어 완전 지원이 이루어져 한국 유저 비율이 크게 증가했습니다.",
        "key_issues": ["신규 지역 스케일 호평", "엔드게임 콘텐츠 다양성", "길드 시스템 개선", "최적화 아직 아쉬움"],
        "top_langs": ["영어", "중국어 간체", "한국어", "일본어"],
        "kr_summary": "시즌 2 사태 이후 가장 좋은 반응. 한국어 완전 지원으로 한국 유저 리뷰 비율이 크게 증가.",
        "color": "#82C29A",
        "user_edited": False,
    },
]

# appid → 타임라인 데이터 맵핑
TIMELINE_MAP = {
    2161700: TIMELINE_ONCE_HUMAN,
}


# ─────────────────────────────────────────────
#  UTILITY FUNCTIONS
# ─────────────────────────────────────────────
def get_rating_info(pct: int) -> tuple:
    """긍정 비율 → (라벨, 색상, 약칭) — 색상은 sentiment_color()와 일치."""
    if pct >= 95:
        return "압도적으로 긍정적", "#BBDEFB", "압긍"
    elif pct >= 80:
        return "매우 긍정적", "#BBDEFB", "매긍"
    elif pct >= 70:
        return "대체로 긍정적", "#C8E6FF", "대긍"
    elif pct >= 40:
        return "복합적", "#FFF9C4", "복합"
    elif pct >= 25:
        return "대체로 부정적", "#FFE0B2", "대부"
    else:
        return "압도적으로 부정적", "#FFCDD2", "압부"


def sentiment_color(pct: int) -> str:
    """긍정 비율 → 카드/차트 색상 (파랑=긍정, 빨강=부정)."""
    if pct >= 80: return "#BBDEFB"
    if pct >= 70: return "#C8E6FF"
    if pct >= 40: return "#FFF9C4"
    if pct >= 25: return "#FFE0B2"
    return "#FFCDD2"


def get_event_type_style(event_type: str) -> tuple:
    """이벤트 타입 → (배경색, 텍스트색) — 내부 호환용 (UI에서는 미사용)."""
    styles = {
        "launch":      ("#6DC2FF", "#1E1E1E"),
        "update":      ("#82C29A", "#1E1E1E"),
        "crisis":      ("#FFD166", "#1E1E1E"),
        "controversy": ("#FF9F9F", "#1E1E1E"),
        "recovery":    ("#E8D5FF", "#1E1E1E"),
    }
    return styles.get(event_type, ("#E0E0E0", "#1E1E1E"))


def _sheets_to_display_event(e: dict) -> dict:
    """Google Sheets 타임라인 레코드를 render_event_card 포맷으로 변환합니다."""
    import json as _j
    date_str   = e.get("date", "")
    period_end = e.get("period_end", "")
    if date_str and period_end:
        period = f"{date_str[:7].replace('-','.')} ~ {period_end[:7].replace('-','.')}"
    elif date_str:
        period = date_str[:7].replace("-", ".")
    else:
        period = "—"

    def _split_pipe(val) -> list:
        if isinstance(val, list):
            return val
        return [v.strip() for v in str(val).split("|") if v.strip()]

    def _parse_top_reviews(val) -> list:
        if isinstance(val, list):
            return val
        if isinstance(val, str) and val.strip():
            try:
                return _j.loads(val)
            except Exception:
                return []
        return []

    event_type = e.get("type", "update")
    return {
        "event_id":        e.get("event_id", ""),
        "name":            e.get("name", ""),
        "date":            date_str,
        "period":          period,
        "period_end":      period_end,
        "type":            event_type,
        "type_label":      e.get("type_label", event_type),
        "color":           sentiment_color(int(e.get("sentiment_pct") or 50)),
        "sentiment_pct":   int(e.get("sentiment_pct") or 50),
        "review_count":    int(e.get("review_count") or 0),
        "description":     e.get("description", ""),
        "key_issues":      _split_pipe(e.get("key_issues", "")),
        "top_langs":       _split_pipe(e.get("top_langs", "")),
        "kr_summary":      e.get("kr_summary", ""),
        "user_edited":     str(e.get("user_edited", "")).lower() == "true",
        "source_url":      e.get("source_url", ""),
        "top_reviews":     _parse_top_reviews(e.get("top_reviews", "")),
        "generation_uuid": e.get("generation_uuid", ""),
    }


def fmt_number(n: int) -> str:
    if n >= 10000:
        return f"{n // 10000}만 {n % 10000:,}"
    return f"{n:,}"


def create_sentiment_chart(events: list, reverse: bool = False) -> go.Figure:
    """민심 추이 Plotly 차트 생성"""
    ordered = list(reversed(events)) if reverse else events
    indices = list(range(len(ordered)))  # 숫자 x축 (날짜 대신)
    pcts    = [e["sentiment_pct"] for e in ordered]
    colors  = [sentiment_color(e["sentiment_pct"]) for e in ordered]
    # hover용 커스텀 데이터: 이름, 날짜, period
    custom  = [
        f"{e['name']}<br>{e.get('date','')} ~ {e.get('period_end','')}"
        for e in ordered
    ]

    fig = go.Figure()

    # 배경 구간 (파란/노란/빨간 — sentiment_color와 동일 스펙트럼)
    fig.add_hrect(y0=70, y1=105, fillcolor="#BBDEFB", opacity=0.15, line_width=0)
    fig.add_hrect(y0=40, y1=70,  fillcolor="#FFF9C4", opacity=0.20, line_width=0)
    fig.add_hrect(y0=0,  y1=40,  fillcolor="#FFCDD2", opacity=0.18, line_width=0)

    # 구간 레이블 (왼쪽 y축 대신 텍스트로)
    if indices:
        for y_val, txt, col in [
            (90, "긍정적", "#1565C0"),
            (55, "복합적", "#A07820"),
            (20, "부정적", "#B71C1C"),
        ]:
            fig.add_annotation(
                x=indices[0], y=y_val, text=txt, showarrow=False,
                font=dict(size=9, color=col, family="Pretendard Variable"),
                xanchor="left", yanchor="middle", xshift=-36,
            )

    fig.add_trace(go.Scatter(
        x=indices, y=pcts,
        mode="lines+markers",
        line=dict(color="#1E1E1E", width=2, shape="spline"),
        marker=dict(color=colors, size=14, line=dict(color="#1E1E1E", width=1.5)),
        hovertemplate="<b>%{customdata}</b><br>긍정 비율: %{y}%<extra></extra>",
        customdata=custom,
    ))

    for i, (idx, p) in enumerate(zip(indices, pcts)):
        fig.add_annotation(
            x=idx, y=p + 5, text=f"{p}%",
            showarrow=False,
            font=dict(size=10, color="#1E1E1E", family="Pretendard Variable"),
            yanchor="bottom",
        )

    # 이벤트 이름 x축 레이블
    fig.update_layout(
        plot_bgcolor="#FFFFFF",
        paper_bgcolor="#FFFFFF",
        height=300,
        margin=dict(l=44, r=20, t=30, b=80),
        xaxis=dict(
            showgrid=False,
            linecolor="#1E1E1E", linewidth=1.5,
            tickmode="array",
            tickvals=indices,
            ticktext=[e["name"] for e in ordered],
            tickfont=dict(size=10, color="#1E1E1E", family="Pretendard Variable"),
            tickangle=-25,
            showticklabels=True,
        ),
        yaxis=dict(
            showgrid=False,
            showticklabels=False,
            linecolor="#1E1E1E", linewidth=1.5,
            range=[0, 115],
        ),
        showlegend=False,
        hoverlabel=dict(bgcolor="#1E1E1E", font_color="#FFFFFF", bordercolor="#1E1E1E"),
    )
    return fig


# ─────────────────────────────────────────────
#  COMPONENT: 게임 카드 (홈 / 검색)
# ─────────────────────────────────────────────
def render_game_card(game: dict, analyzed: bool = True):
    label, color, abbr = get_rating_info(game["rating_pct"])
    badge_bg = color
    rel = game.get("release_date", "")
    rel_str = rel[:7] if len(rel) >= 7 else rel
    st.markdown(
        f'<div style="background:#FFFFFF;border:1.5px solid #1E1E1E;border-radius:20px;overflow:hidden;margin-bottom:4px;">'
        f'<img src="{game["thumbnail"]}" style="width:100%;height:140px;object-fit:cover;border-bottom:1.5px solid #1E1E1E;display:block;">'
        f'<div style="padding:16px 18px 18px 18px;">'
        f'<div style="font-size:15px;font-weight:700;color:#1E1E1E;word-break:keep-all;margin-bottom:4px;">{game["name"]}</div>'
        f'<div style="font-size:11px;color:#757575;margin-bottom:10px;">{game["name_en"]} · 출시 {rel_str}</div>'
        f'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
        f'<span style="font-size:11px;font-weight:700;background:{badge_bg};border:1.5px solid #1E1E1E;border-radius:8px;padding:3px 10px;color:#1E1E1E;">{abbr} {game["rating_pct"]}%</span>'
        f'<span style="font-size:11px;color:#757575;background:#F4F5F7;border:1.5px solid #1E1E1E;border-radius:8px;padding:3px 10px;">리뷰 {fmt_number(game["total_reviews"])}건</span>'
        f'</div></div></div>',
        unsafe_allow_html=True,
    )

    btn_label = "타임라인 보기 →" if analyzed else "분석 시작하기 →"
    if st.button(btn_label, key=f"btn_{game['appid']}"):
        st.session_state.current_game      = game["appid"]
        st.session_state.current_game_data = game   # 검색 결과 게임 정보 보존
        st.session_state.page = "game"
        st.rerun()


# ─────────────────────────────────────────────
#  COMPONENT: 타임라인 이벤트 카드
# ─────────────────────────────────────────────
def render_event_card(event: dict, is_last: bool = False):
    label, _, abbr = get_rating_info(event["sentiment_pct"])
    evt_color = sentiment_color(event["sentiment_pct"])
    line_html = "" if is_last else '<div style="width:2px;background:#D5D5D5;flex:1;margin-top:0;"></div>'

    edited_badge = ""
    if event.get("user_edited"):
        edited_badge = '<span style="font-size:10px;font-weight:700;background:#E8D5FF;border:1.5px solid #C4A0FF;border-radius:6px;padding:2px 8px;margin-left:8px;color:#5A3FA0;">✏️ 유저 수정</span>'

    source_url = event.get("source_url", "")
    source_link_html = (
        f'<a href="{source_url}" target="_blank" rel="noopener" '
        f'style="font-size:11px;color:#1E1E1E;background:#F4F5F7;border:1.5px solid #1E1E1E;'
        f'border-radius:8px;padding:3px 10px;text-decoration:none;white-space:nowrap;">📝 참고 패치노트 →</a>'
        if source_url else ""
    )

    issue_chips = "".join([
        f'<span style="font-size:11px;background:#F4F5F7;border:1.5px solid #D5D5D5;'
        f'border-radius:8px;padding:3px 10px;color:#444;white-space:nowrap;">{issue}</span>'
        for issue in event.get("key_issues", [])
    ])
    lang_chips = "".join([
        f'<span style="font-size:11px;background:#FFFFFF;border:1.5px solid #1E1E1E;'
        f'border-radius:8px;padding:3px 10px;color:#1E1E1E;font-weight:600;">{lang}</span>'
        for lang in event.get("top_langs", [])
    ])

    # 해당 기간 주요 리뷰
    top_reviews = event.get("top_reviews", [])
    reviews_html = ""
    if top_reviews:
        items_html = ""
        for r in top_reviews[:2]:
            voted        = "👍" if r.get("voted_up") else "👎"
            lang         = r.get("language", "")
            lang_label   = STEAM_LANG_KO.get(lang, lang)
            text         = (r.get("text") or "")[:280]
            v_up         = r.get("votes_up", 0)
            translation  = r.get("translation_kr", "")
            is_korean    = lang in ("koreana",)
            trans_html   = (
                f'<div style="font-size:11px;color:#888;font-style:italic;margin-top:5px;'
                f'border-left:2px solid #D5D5D5;padding-left:8px;line-height:1.6;">'
                f'🇰🇷 {translation}</div>'
                if (not is_korean and translation) else ""
            )
            items_html += (
                f'<div style="padding:10px 0;border-top:1px solid #EFEFEF;">'
                f'<div style="display:flex;gap:6px;align-items:center;margin-bottom:5px;">'
                f'<span style="font-size:13px;">{voted}</span>'
                f'<span style="font-size:10px;background:#F4F5F7;border:1px solid #D5D5D5;'
                f'border-radius:6px;padding:1px 7px;color:#555;">{lang_label}</span>'
                f'<span style="font-size:10px;color:#AAAAAA;">추천 {v_up}개</span>'
                f'</div>'
                f'<div style="font-size:12px;color:#333;line-height:1.65;">{text}</div>'
                f'{trans_html}'
                f'</div>'
            )
        reviews_html = (
            f'<div style="margin-bottom:14px;">'
            f'<div style="font-size:10px;font-weight:700;color:#757575;margin-bottom:2px;letter-spacing:0.5px;">💬 해당 기간 주요 리뷰</div>'
            f'{items_html}</div>'
        )

    st.markdown(
        f'<div style="display:flex;align-items:stretch;">'
        f'<div style="width:44px;min-width:44px;display:flex;flex-direction:column;align-items:center;padding-top:4px;">'
        f'<div style="width:16px;height:16px;border-radius:50%;background:{evt_color};border:2px solid #1E1E1E;flex-shrink:0;z-index:1;"></div>'
        f'{line_html}</div>'
        f'<div style="flex:1;padding:0 0 28px 16px;">'
        f'<div style="font-size:11px;color:#757575;font-weight:600;margin-bottom:8px;letter-spacing:0.3px;">'
        f'{event["date"]} &nbsp;·&nbsp; {event["period"]}</div>'
        f'<div style="background:#FFFFFF;border:1.5px solid #1E1E1E;border-radius:20px;padding:22px 24px;">'
        # 헤더: 이름 + 수정 뱃지 + 패치노트 링크 (타입 뱃지 제거)
        f'<div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:14px;">'
        f'<span style="font-size:17px;font-weight:700;color:#1E1E1E;word-break:keep-all;">{event["name"]}</span>'
        f'{edited_badge}{source_link_html}</div>'
        # 감성 + 리뷰 수 뱃지
        f'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">'
        + (
            f'<div class="tt" style="background:{evt_color};border:1.5px solid #1E1E1E;border-radius:10px;padding:6px 14px;">'
            f'<span style="font-size:13px;font-weight:700;color:#1E1E1E;">{event["sentiment_pct"]}% 긍정</span>'
            f'<span style="font-size:12px;color:#1E1E1E;opacity:0.55;"> · {label}</span>'
            f'<span class="ttb">이 기간에 수집된 리뷰의 👍 비율.<br>시트 누적 리뷰 기반 실측치.<br>수집된 리뷰가 적을수록 오차가 커질 수 있습니다.</span></div>'
        )
        + (
            (
                f'<div class="tt" style="background:#F4F5F7;border:1.5px solid #1E1E1E;border-radius:10px;padding:6px 14px;">'
                f'<span style="font-size:12px;color:#757575;">리뷰 </span>'
                f'<span style="font-size:13px;font-weight:700;color:#1E1E1E;">{fmt_number(event["review_count"])}건</span>'
                f'<span class="ttb">이 기간(날짜 기준)에 실제 작성된 리뷰 수.<br>시트 누적 리뷰의 timestamp 기반 실측치.<br>0건 = 해당 기간 리뷰 아직 미수집.</span></div>'
            ) if event["review_count"] > 0 else (
                f'<div class="tt" style="background:#F9F9F9;border:1.5px dashed #CCCCCC;border-radius:10px;padding:6px 14px;">'
                f'<span style="font-size:12px;color:#AAAAAA;">리뷰 수집 전 기간</span>'
                f'<span class="ttb">이 기간 리뷰가 아직 시트에 수집되지 않았습니다.<br>스팀곡괭이가 매일 05:00 KST에 누적 수집하며<br>리뷰가 쌓이면 수치가 채워집니다.</span></div>'
            )
        )
        + f'</div>'
        # 설명
        f'<p style="font-size:13px;color:#444;line-height:1.75;margin:0 0 14px 0;word-break:keep-all;">{event["description"]}</p>'
        # 이슈 칩
        f'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">{issue_chips}</div>'
        # 유저 반응 요약
        f'<div style="background:#F4F5F7;border-radius:12px;padding:12px 16px;margin-bottom:14px;">'
        f'<div class="tt" style="font-size:10px;font-weight:700;color:#757575;margin-bottom:4px;letter-spacing:0.5px;display:inline-flex;align-items:center;gap:4px;">💬 유저 반응 요약'
        f'<span class="ttb">이 기간 수집된 전체 언어 리뷰를 Gemini AI가 분석·요약.<br>실제 리뷰 샘플과 월별 통계를 함께 참조.</span></div>'
        f'<div style="font-size:13px;color:#1E1E1E;line-height:1.7;word-break:keep-all;">{event["kr_summary"]}</div></div>'
        # 주요 리뷰 원문
        f'{reviews_html}'
        # 언어 분포
        f'<div class="tt" style="display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px;">'
        f'<span style="font-size:11px;color:#757575;font-weight:600;">TOP 리뷰 언어</span>{lang_chips}'
        f'<span class="ttb">이 기간 수집된 리뷰 중 votes_up 상위 리뷰들의 언어 분포.<br>Gemini AI가 분석에 활용한 주요 언어.</span></div>'
        f'</div></div></div>',
        unsafe_allow_html=True,
    )


# ─────────────────────────────────────────────
#  PAGE: 홈
# ─────────────────────────────────────────────
def render_home():
    st.markdown("""<div style="padding:8px 0 32px 0;"><div style="display:flex;align-items:center;gap:14px;"><div style="width:46px;height:46px;background:#1E1E1E;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">⚙️</div><div><div style="font-size:24px;font-weight:900;color:#1E1E1E;line-height:1.2;">리뷰 속에 답이 있다</div><div style="font-size:12px;color:#757575;font-weight:400;margin-top:2px;">스팀탈곡기 mk2 — Steam Review Timeline Machine</div></div></div></div>""",
        unsafe_allow_html=True)

    _, col_search, _ = st.columns([1, 6, 1])
    with col_search:
        search_query = st.text_input(
            label="search",
            placeholder="🔍  게임명을 입력하세요  (예: Palworld, Helldivers 2, Once Human...)",
            key="search_input",
            label_visibility="collapsed",
        )
    _, col_hint, _ = st.columns([1, 6, 1])
    with col_hint:
        st.markdown("""<div style="font-size:11px;color:#AAAAAA;margin-top:6px;text-align:center;">Steam 검색은 <b>영어 게임명</b>으로 입력하면 더 정확합니다 &nbsp;·&nbsp; 한글 검색 시 결과가 없을 수 있어요</div>""", unsafe_allow_html=True)

    # 타임라인 생성된 게임 목록 (시트 우선, 없으면 빈 리스트)
    analyzed_games = _load_analyzed_games()
    analyzed_ids   = {g["appid"] for g in analyzed_games}

    if search_query and len(search_query.strip()) > 0:
        with st.spinner("🔍  Steam에서 검색 중..."):
            results = steam_search(search_query.strip())

        # 타임라인 보유 게임 앞으로 정렬
        results_sorted = sorted(results, key=lambda g: g["appid"] not in analyzed_ids)

        st.markdown(f"""<div style="margin:24px 0 12px 0;font-size:13px;color:#757575;font-weight:500;">"{search_query}" Steam 검색 결과 — {len(results_sorted)}개 게임</div>""",
            unsafe_allow_html=True)
        if results_sorted:
            cols = st.columns(4)
            for i, game in enumerate(results_sorted):
                with cols[i % 4]:
                    render_game_card(game, analyzed=(game["appid"] in analyzed_ids))
        else:
            st.markdown(f"""<div style="background:#FFFFFF;border:1.5px solid #1E1E1E;border-radius:20px;padding:48px;text-align:center;"><div style="font-size:28px;margin-bottom:14px;">🔍</div><div style="font-size:15px;font-weight:700;color:#1E1E1E;margin-bottom:8px;">"{search_query}"에 해당하는 게임을 찾지 못했습니다</div><div style="font-size:13px;color:#757575;line-height:1.8;word-break:keep-all;">Steam 검색 API는 <b style="color:#1E1E1E;">영어 게임명</b>으로 검색할 때 가장 정확합니다.<br>예) 붉은사막 → <b style="color:#1E1E1E;">Crimson Desert</b> &nbsp;·&nbsp; 검은사막 → <b style="color:#1E1E1E;">Black Desert</b></div></div>""",
                unsafe_allow_html=True)
    else:
        st.markdown("""<div style="margin:28px 0 14px 0;display:flex;align-items:center;gap:10px;"><div style="font-size:16px;font-weight:700;color:#1E1E1E;">타임라인이 생성된 게임</div><div style="width:8px;height:8px;background:#82C29A;border-radius:50%;border:1.5px solid #1E1E1E;"></div><div style="font-size:12px;color:#757575;">클릭하면 타임라인을 바로 확인할 수 있습니다</div></div>""",
            unsafe_allow_html=True)
        if analyzed_games:
            cols = st.columns(4)
            for i, game in enumerate(analyzed_games):
                with cols[i % 4]:
                    render_game_card(game, analyzed=True)
        else:
            st.markdown("""<div style="background:#FFFFFF;border:1.5px dashed #D5D5D5;border-radius:20px;padding:48px;text-align:center;"><div style="font-size:32px;margin-bottom:12px;">⚙️</div><div style="font-size:15px;font-weight:700;color:#1E1E1E;margin-bottom:6px;">아직 생성된 타임라인이 없습니다</div><div style="font-size:13px;color:#757575;word-break:keep-all;">위 검색창에서 게임을 찾아 타임라인을 생성해보세요.</div></div>""",
                unsafe_allow_html=True)

        st.markdown("""<div style="margin:40px 0 16px 0;"><div style="height:1.5px;background:#1E1E1E;opacity:0.1;margin-bottom:24px;"></div><div style="background:#FFFFFF;border:1.5px dashed #D5D5D5;border-radius:20px;padding:32px;text-align:center;"><div style="font-size:13px;color:#757575;margin-bottom:4px;">새로운 게임의 타임라인을 만들고 싶다면</div><div style="font-size:15px;font-weight:700;color:#1E1E1E;">위 검색창에서 게임을 검색하세요 🔍</div></div></div>""",
            unsafe_allow_html=True)


# ─────────────────────────────────────────────
#  PAGE: 미분석 게임 — 분석 준비 페이지
# ─────────────────────────────────────────────
def render_new_game_page(game: dict):
    label, color, abbr = get_rating_info(game.get("rating_pct", 0))

    # 뒤로가기
    col_back, _ = st.columns([1, 9])
    with col_back:
        if st.button("← 목록으로"):
            st.session_state.page = "home"
            st.rerun()

    # 게임 헤더 카드
    st.markdown(f"""<div style="background:#FFFFFF;border:1.5px solid #1E1E1E;border-radius:20px;overflow:hidden;margin:12px 0 20px 0;display:grid;grid-template-columns:300px 1fr;"><img src="{game['thumbnail']}" style="width:100%;height:100%;min-height:175px;object-fit:cover;display:block;border-right:1.5px solid #1E1E1E;"><div style="padding:24px 28px;"><div style="font-size:22px;font-weight:900;color:#1E1E1E;margin-bottom:6px;word-break:keep-all;">{game['name']}</div><div style="font-size:13px;color:#757575;margin-bottom:16px;">{game.get('name_en','')} &nbsp;·&nbsp; 출시 {game.get('release_date','—')}</div><div style="display:flex;gap:10px;flex-wrap:wrap;"><div style="background:{color};border:1.5px solid #1E1E1E;border-radius:10px;padding:6px 16px;"><span style="font-size:13px;font-weight:700;color:#1E1E1E;">{abbr}</span><span style="font-size:12px;color:#1E1E1E;opacity:0.55;"> · 전체 {game.get('rating_pct',0)}% 긍정</span></div><div style="background:#F4F5F7;border:1.5px solid #1E1E1E;border-radius:10px;padding:6px 16px;"><span style="font-size:12px;color:#757575;">총 리뷰 </span><span style="font-size:13px;font-weight:700;color:#1E1E1E;">{fmt_number(game.get('total_reviews',0))}건</span></div></div></div></div>""",
        unsafe_allow_html=True)

    # 분석 준비 안내
    st.markdown(f"""<div style="background:#FFFFFF;border:1.5px solid #1E1E1E;border-radius:20px;overflow:hidden;"><div style="padding:32px 36px;"><div style="font-size:18px;font-weight:700;color:#1E1E1E;margin-bottom:10px;word-break:keep-all;">⚙️ 이 게임의 타임라인을 생성하시겠습니까?</div><div style="font-size:13px;color:#757575;line-height:1.8;margin-bottom:24px;word-break:keep-all;">리뷰 <b style="color:#1E1E1E;">500건</b>을 즉시 수집하여 초기 타임라인을 생성합니다.<br>이후 스팀곡괭이가 전체 <b style="color:#1E1E1E;">{fmt_number(game.get('total_reviews',0))}건</b>을 매일 자동 수집하며 타임라인을 최신화합니다.<br>초기 생성은 약 <b style="color:#1E1E1E;">1~3분</b> 소요됩니다.</div><div style="display:flex;flex-wrap:wrap;gap:12px;"><div style="background:#F4F5F7;border:1.5px solid #1E1E1E;border-radius:12px;padding:14px 20px;flex:1;min-width:160px;"><div style="font-size:11px;color:#757575;font-weight:600;margin-bottom:4px;">STEP 1</div><div style="font-size:13px;font-weight:700;color:#1E1E1E;">⛏ 즉시 수집</div><div style="font-size:12px;color:#757575;margin-top:2px;">리뷰 500건 + 패치노트</div></div><div style="background:#F4F5F7;border:1.5px solid #1E1E1E;border-radius:12px;padding:14px 20px;flex:1;min-width:160px;"><div style="font-size:11px;color:#757575;font-weight:600;margin-bottom:4px;">STEP 2</div><div style="font-size:13px;font-weight:700;color:#1E1E1E;">🤖 Gemini 분석</div><div style="font-size:12px;color:#757575;margin-top:2px;">이벤트 탐지 + 민심 요약</div></div><div style="background:#F4F5F7;border:1.5px solid #1E1E1E;border-radius:12px;padding:14px 20px;flex:1;min-width:160px;"><div style="font-size:11px;color:#757575;font-weight:600;margin-bottom:4px;">STEP 3</div><div style="font-size:13px;font-weight:700;color:#1E1E1E;">🔄 자동 최신화</div><div style="font-size:12px;color:#757575;margin-top:2px;">매일 05:00 KST 증분 업데이트</div></div></div></div></div>""",
        unsafe_allow_html=True)

    st.markdown("<div style='height:16px;'></div>", unsafe_allow_html=True)

    if not sheets_ready():
        # Sheets 미연결 — 설정 안내 카드
        st.markdown("""<div style="background:#FFFFFF;border:1.5px solid #1E1E1E;border-radius:20px;padding:22px 28px;"><div style="font-size:14px;font-weight:700;color:#1E1E1E;margin-bottom:8px;">⚙️ Google Sheets 연결이 필요합니다</div><div style="font-size:13px;color:#757575;line-height:1.8;word-break:keep-all;">Streamlit Cloud 앱 설정에서 Secrets를 입력하면 분석을 시작할 수 있습니다.<br>아래 버튼을 누르면 설정 방법이 표시됩니다.</div></div>""",
            unsafe_allow_html=True)
        st.markdown("<div style='height:10px;'></div>", unsafe_allow_html=True)
        with st.expander("📋 Secrets 설정 방법 보기"):
            st.markdown("""
**1단계 — 서비스 계정 키 파일 다운로드**
- Google Cloud Console → IAM → 서비스 계정 → `steam-pickaxe@steam-pickaxe.iam.gserviceaccount.com`
- **키** 탭 → **키 추가** → **JSON** → 다운로드

**2단계 — Streamlit Cloud Secrets 입력**
- [share.streamlit.io](https://share.streamlit.io) → 앱 클릭 → ⋮ → **Settings** → **Secrets**
- 아래 형식으로 입력 후 **Save**:

```toml
MASTER_SPREADSHEET_ID = "1ViHc_sx751hiER4gyT3YvqgjvR_Vd0dbZA3FJzzkgRw"
GEMINI_API_KEY        = "your_gemini_key"

[GOOGLE_SERVICE_ACCOUNT]
type                        = "service_account"
project_id                  = "steam-pickaxe"
private_key_id              = "다운로드한 JSON의 private_key_id 값"
private_key                 = "다운로드한 JSON의 private_key 값 (줄바꿈 포함)"
client_email                = "steam-pickaxe@steam-pickaxe.iam.gserviceaccount.com"
client_id                   = "다운로드한 JSON의 client_id 값"
auth_uri                    = "https://accounts.google.com/o/oauth2/auth"
token_uri                   = "https://oauth2.googleapis.com/token"
auth_provider_x509_cert_url = "https://www.googleapis.com/oauth2/v1/certs"
client_x509_cert_url        = "다운로드한 JSON의 client_x509_cert_url 값"
universe_domain             = "googleapis.com"
```

**3단계 — 앱 재시작**
- Secrets 저장 후 앱이 자동으로 재시작됩니다.
""")
    else:
        col_btn, _ = st.columns([3, 7])
        with col_btn:
            if st.button("⚙️  이 게임 타임라인 생성 시작", key="start_analysis"):
                _run_analysis_pipeline(game)


def _run_analysis_pipeline(game: dict):
    """즉시 수집 → Gemini 분석 → 시트 저장 → 타임라인 페이지 이동."""
    import json as _json
    appid = game["appid"]
    st.session_state.pop(f"ver_{appid}", None)
    toast = st.empty()   # 우상단 토스트
    done: list[str] = []

    def _render(current: str = "", error: str = ""):
        if error:
            icon, bg, border, txt_color = "❌", "#FFF0F0", "#FFCDD2", "#B71C1C"
            headline = "오류 발생"
            body = f'<div style="font-size:12px;color:#B71C1C;margin-top:6px;word-break:break-all;">{error}</div>'
        elif current:
            icon, bg, border, txt_color = "⏳", "#FFFDE7", "#FFE082", "#5D4037"
            headline = current
            body = ""
        else:
            icon, bg, border, txt_color = "✅", "#E8F5E9", "#A5D6A7", "#1B5E20"
            headline = "타임라인 생성 완료!"
            body = ""
        steps_html = "".join(
            f'<div style="font-size:11px;color:#555;padding:2px 0;">'
            f'✓ {s}</div>'
            for s in done
        )
        toast.markdown(
            f'<div style="position:fixed;top:16px;right:16px;z-index:99999;'
            f'background:{bg};border:1.5px solid {border};border-radius:16px;'
            f'padding:14px 18px;min-width:240px;max-width:320px;'
            f'box-shadow:0 4px 20px rgba(0,0,0,0.15);">'
            f'<div style="font-size:13px;font-weight:700;color:{txt_color};'
            f'display:flex;align-items:center;gap:8px;margin-bottom:6px;">'
            f'{icon} {headline}</div>'
            f'{steps_html}{body}'
            f'</div>',
            unsafe_allow_html=True,
        )

    try:
        _render("⛏ 리뷰 수집 중 (최대 500건)...")
        reviews, final_cursor = _steam_collect(appid, max_pages=5, delay=0.2)
        done.append(f"리뷰 {len(reviews)}건 수집 완료")

        _render("🗞 Steam 패치노트 수집 중...")
        news = _steam_news(appid, count=50)
        done.append(f"패치노트 {len(news)}건 수집 완료")

        _render("💾 Google Sheets에 저장 중...")
        client = get_sheets_client()
        _sheets_register_game(
            client, appid, game["name"],
            game.get("name_en", game["name"]),
            game.get("release_date", ""),
        )
        _sheets_save_reviews(client, appid, reviews, final_cursor)

        # 시트에 쌓인 전체 리뷰 로드 → Gemini에 전달
        all_reviews = _sheets_load_reviews(client, appid)
        total_for_analysis = all_reviews if all_reviews else reviews
        done.append(f"시트 누적 리뷰 {len(total_for_analysis):,}건 기반으로 분석 준비")

        _render("🤖 Gemini AI 분석 중... (1~2분 소요)")
        events, gen_uuid = _gemini_analyze(
            game_name=game["name"],
            release_date=game.get("release_date", ""),
            total_reviews=game.get("total_reviews", 0),
            reviews=total_for_analysis,
            steam_news=news,
        )
        done.append(f"이벤트 {len(events)}개 탐지 완료  ·  UUID {gen_uuid}")

        _render("💾 타임라인 저장 중...")
        _sheets_save_timeline(client, appid, events, overwrite=True)

        from datetime import datetime, timezone as _tz
        _sheets_save_tl_version(
            client, appid,
            uuid=gen_uuid,
            created_at=datetime.now(_tz.utc).isoformat(),
            based_on_reviews=len(total_for_analysis),
            based_on_news=len(news),
            event_count=len(events),
            events_json=_json.dumps(events, ensure_ascii=False),
        )
        done.append("Google Sheets 저장 완료")
        _render()

        st.session_state.cached_timeline = {appid: events}
        st.session_state.cached_uuid     = {appid: gen_uuid}
        st.session_state.page = "game"
        st.rerun()

    except Exception as e:
        _render(error=str(e))


# ─────────────────────────────────────────────
#  PAGE: 게임 타임라인 상세
# ─────────────────────────────────────────────
def render_game_detail(appid: int):
    import json as _json
    # 시트 기반 analyzed_ids 사용 (mock 제거)
    analyzed_ids: set[int] = set()

    # 게임 정보: 이름/썸네일은 session_state 우선, 리뷰 통계는 항상 Steam API (캐시 10분)
    fresh = steam_game_detail(appid)
    cached = st.session_state.get("current_game_data", {})
    if cached and cached.get("appid") == appid:
        game = {
            **cached,
            "total_reviews": fresh.get("total_reviews") or cached.get("total_reviews", 0),
            "rating_pct":    fresh.get("rating_pct")    or cached.get("rating_pct", 0),
            "rating_label":  fresh.get("rating_label")  or cached.get("rating_label", ""),
        }
    else:
        game = fresh

    # ── 이벤트 소스 결정 ──
    client = None
    cached_tl = st.session_state.get("cached_timeline", {})
    if appid in cached_tl:
        raw_events = cached_tl[appid]
        events = [_sheets_to_display_event(e) for e in raw_events]
        is_real_data   = True
        is_initial     = True
        reviewed_count = sum(e.get("review_count", 0) for e in events)
    elif sheets_ready():
        client = get_sheets_client()
        game_info_sheet = _sheets_get_game_info(client, appid)
        if game_info_sheet:
            raw_events = _sheets_load_timeline(client, appid)
            events = [_sheets_to_display_event(e) for e in raw_events]
            is_real_data   = True
            is_initial     = int(game_info_sheet.get("total_archived") or 0) < 5000
            reviewed_count = int(game_info_sheet.get("total_archived") or 0)
        else:
            render_new_game_page(game)
            return
    else:
        render_new_game_page(game)
        return

    # ── 현재 UUID 추출 ──
    current_uuid = ""
    if events and is_real_data:
        current_uuid = (events[0].get("generation_uuid", "") or
                        st.session_state.get("cached_uuid", {}).get(appid, ""))

    # ── 버전 히스토리 로드 ──
    versions: list[dict] = []
    if is_real_data and sheets_ready():
        try:
            _cl = client or get_sheets_client()
            versions = _sheets_load_tl_versions(_cl, appid)
        except Exception:
            pass

    # ── 버전 선택 상태 관리 ──
    sel_ver_key = f"ver_{appid}"
    if sel_ver_key not in st.session_state:
        st.session_state[sel_ver_key] = current_uuid

    active_uuid   = st.session_state[sel_ver_key] or current_uuid
    active_count  = reviewed_count

    # 선택한 버전이 현재 최신과 다를 때 해당 버전 events_json 로드
    if active_uuid and active_uuid != current_uuid and versions:
        for v in versions:
            if v.get("uuid") == active_uuid:
                try:
                    ver_raw = _json.loads(v.get("events_json", "[]"))
                    events  = [_sheets_to_display_event(e) for e in ver_raw]
                    active_count = int(v.get("based_on_reviews") or 0)
                except Exception:
                    pass
                break

    label, color, abbr = get_rating_info(game.get("rating_pct", 0))

    # ── 뒤로가기 ──
    col_back, _ = st.columns([1, 9])
    with col_back:
        if st.button("← 목록으로"):
            st.session_state.pop("cached_timeline", None)
            st.session_state.page = "home"
            st.rerun()

    # ── 게임 헤더 카드 ──
    _steam_url = f"https://store.steampowered.com/app/{appid}/"
    st.markdown(
        f'<div style="background:#FFFFFF;border:1.5px solid #1E1E1E;border-radius:20px;overflow:hidden;margin:12px 0 20px 0;display:grid;grid-template-columns:300px 1fr;">'
        f'<img src="{game["thumbnail"]}" style="width:100%;height:100%;min-height:175px;object-fit:cover;display:block;border-right:1.5px solid #1E1E1E;">'
        f'<div style="padding:24px 28px;">'
        f'<div style="font-size:22px;font-weight:900;color:#1E1E1E;margin-bottom:6px;word-break:keep-all;">{game["name"]}</div>'
        f'<div style="font-size:13px;color:#757575;margin-bottom:16px;">{game.get("name_en","")} &nbsp;·&nbsp; 출시 {game.get("release_date","—")} &nbsp;·&nbsp; <span style="font-family:monospace;font-size:12px;">App {appid}</span></div>'
        f'<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">'
        f'<div style="background:{color};border:1.5px solid #1E1E1E;border-radius:10px;padding:6px 16px;"><span style="font-size:13px;font-weight:700;color:#1E1E1E;">{abbr}</span><span style="font-size:12px;color:#1E1E1E;opacity:0.55;"> · 전체 {game.get("rating_pct",0)}% 긍정</span></div>'
        f'<div style="background:#F4F5F7;border:1.5px solid #1E1E1E;border-radius:10px;padding:6px 16px;"><span style="font-size:12px;color:#757575;">총 리뷰 </span><span style="font-size:13px;font-weight:700;color:#1E1E1E;">{fmt_number(game.get("total_reviews",0))}건</span></div>'
        f'<a href="{_steam_url}" target="_blank" rel="noopener" style="font-size:12px;font-weight:600;color:#1E1E1E;background:#FFFFFF;border:1.5px solid #1E1E1E;border-radius:10px;padding:6px 14px;text-decoration:none;white-space:nowrap;">🔗 Steam 페이지 →</a>'
        f'</div></div></div>',
        unsafe_allow_html=True,
    )

    # ── 초기 분석 안내 배너 ──
    if is_real_data and is_initial:
        total_steam = game.get("total_reviews", 0)
        st.markdown(f"""<div style="background:#FFFDE7;border:1.5px solid #1E1E1E;border-radius:16px;padding:16px 22px;margin-bottom:16px;display:flex;align-items:flex-start;gap:14px;"><div style="font-size:22px;line-height:1;">⛏</div><div><div style="font-size:13px;font-weight:700;color:#1E1E1E;margin-bottom:4px;">초기 분석 타임라인 &nbsp;·&nbsp; {fmt_number(active_count)}건 기반</div><div style="font-size:12px;color:#757575;line-height:1.7;">현재 Steam 전체 리뷰 {fmt_number(total_steam)}건 중 초기 샘플로 타임라인을 생성했습니다.<br>스팀곡괭이가 매일 오전 05:00 (KST) 전체 리뷰를 자동 수집하며, 누적될수록 타임라인과 시점별 유저 반응이 더 정확해집니다.</div></div></div>""",
            unsafe_allow_html=True)

    if events:
        # ── 언어별 민심 계산용 리뷰 (캐시) ──
        chart_reviews: list[dict] = []
        if is_real_data:
            chart_reviews = _load_reviews_cached(appid)

        # ── 실측치로 이벤트 통계 갱신 ──
        if chart_reviews:
            events = _apply_actual_stats_to_events(events, chart_reviews)

        # ── 분석 기반 리뷰 수 = 시트 실적재 수 ──
        actual_archived = len(chart_reviews) if chart_reviews else active_count

        # ── 메타 정보 + 재생성 버튼 ──
        uuid_badge = (
            f'<span style="font-size:11px;font-family:monospace;background:#F4F5F7;'
            f'border:1px solid #D5D5D5;border-radius:6px;padding:2px 8px;color:#555;">'
            f'UUID {active_uuid}</span>'
            if active_uuid else ""
        )
        col_meta, col_regen_btn = st.columns([7, 3])
        with col_meta:
            st.markdown(
                f'<div style="background:#FFFFFF;border:1.5px solid #1E1E1E;border-radius:16px;'
                f'padding:14px 20px;display:flex;flex-wrap:wrap;gap:14px;align-items:center;height:100%;">'
                + _tt('<span style="font-size:12px;color:#757575;font-weight:600;">총 이벤트</span>',
                      'Gemini AI가 리뷰 트렌드+Steam 뉴스 기반으로 탐지한 주요 이벤트 수.')
                + f'<span style="font-size:13px;font-weight:700;color:#1E1E1E;">{len(events)}개</span>'
                f'<span style="display:inline-block;width:1.5px;height:18px;background:#E0E0E0;"></span>'
                + _tt('<span style="font-size:12px;color:#757575;font-weight:600;">시트 적재 리뷰</span>',
                      f'Google Sheets에 실제 수집·저장된 리뷰 수.<br>이 리뷰들로 각 이벤트의 sentiment·리뷰수를 실측 계산합니다.<br>Steam 전체 리뷰: {fmt_number(game.get("total_reviews",0))}건')
                + f'<span style="font-size:13px;font-weight:700;color:#1E1E1E;">{fmt_number(actual_archived)}건</span>'
                f'<span style="display:inline-block;width:1.5px;height:18px;background:#E0E0E0;"></span>'
                + _tt('<span style="font-size:12px;color:#757575;font-weight:600;">자동 업데이트</span>',
                      '스팀곡괭이(GitHub Actions)가 매일 05:00 KST에 신규 리뷰를 증분 수집.<br>누적 기준(500→2000→10000→...)에 도달할 때마다 타임라인 재분석.')
                + f'<span style="font-size:13px;font-weight:700;color:#1E1E1E;">매일 05:00 KST</span>'
                f'{(" &nbsp;" + uuid_badge) if uuid_badge else ""}'
                f'</div>',
                unsafe_allow_html=True,
            )
        with col_regen_btn:
            if is_real_data and sheets_ready():
                if st.button("🔄 현재 기준으로 타임라인 재생성", key=f"regen_{appid}"):
                    st.session_state.pop(f"ver_widget_{appid}", None)
                    _run_analysis_pipeline(game)

        # ── 버전 선택 (히스토리 2개 이상) ──
        if is_real_data and len(versions) >= 2:
            def _ver_label(v: dict) -> str:
                dt  = (v.get("created_at", "") or "")[:10]
                rv  = fmt_number(int(v.get("based_on_reviews") or 0))
                cnt = v.get("event_count", "?")
                uid = v.get("uuid", "")
                return f"{dt} · 리뷰 {rv}건 · 이벤트 {cnt}개 · {uid}"
            ver_labels = [_ver_label(v) for v in versions]
            cur_idx    = next((i for i, v in enumerate(versions) if v.get("uuid") == active_uuid), 0)
            widget_key = f"ver_widget_{appid}"
            if widget_key not in st.session_state:
                st.session_state[widget_key] = ver_labels[cur_idx]
            col_ver, _ = st.columns([6, 4])
            with col_ver:
                chosen_label = st.selectbox(
                    "버전 선택",
                    options=ver_labels,
                    key=widget_key,
                    label_visibility="collapsed",
                )
            chosen_idx  = ver_labels.index(chosen_label) if chosen_label in ver_labels else 0
            chosen_uuid = versions[chosen_idx].get("uuid", "")
            if chosen_uuid != active_uuid:
                st.session_state[sel_ver_key] = chosen_uuid
                st.rerun()

        # ── 민심 추이 헤더 + 정렬/언어 필터 ──
        st.markdown(
            _tt(
                '<span style="margin:20px 0 10px 0;font-size:16px;font-weight:700;color:#1E1E1E;display:inline-block;">📈 민심 추이</span>',
                '각 이벤트 기간의 긍정 리뷰 비율(%) 추이.<br>'
                '시트에 수집된 리뷰의 voted_up 기반 실측치.<br>'
                '언어 필터 선택 시 해당 언어 리뷰만으로 재계산.'
            ),
            unsafe_allow_html=True,
        )

        _MAIN_LANGS = ["전체", "한국어", "영어", "중국어 간체", "중국어 번체", "기타"]
        _MAIN_LANG_CODES = {"한국어": "koreana", "영어": "english", "중국어 간체": "schinese", "중국어 번체": "tchinese"}

        # 언어 필터만 민심 추이 아래에
        lang_filter = st.radio(
            "언어",
            options=_MAIN_LANGS,
            horizontal=True,
            key=f"lang_filter_{appid}",
            label_visibility="collapsed",
        )

        # 기타 언어 드롭다운
        lang_code_for_chart: str | None = None
        if lang_filter == "기타" and chart_reviews:
            known = set(_MAIN_LANG_CODES.values())
            extra_codes = sorted({r.get("language", "") for r in chart_reviews if r.get("language") and r.get("language") not in known})
            if extra_codes:
                extra_labels = [STEAM_LANG_KO.get(c, c) for c in extra_codes]
                col_extra, _ = st.columns([3, 7])
                with col_extra:
                    sel_extra = st.selectbox(
                        "언어 선택",
                        options=extra_labels,
                        key=f"extra_lang_{appid}",
                        label_visibility="collapsed",
                    )
                lang_code_for_chart = extra_codes[extra_labels.index(sel_extra)] if sel_extra in extra_labels else None
        elif lang_filter in _MAIN_LANG_CODES:
            lang_code_for_chart = _MAIN_LANG_CODES[lang_filter]

        # 언어 필터 적용
        if lang_code_for_chart and chart_reviews:
            events_for_chart = _calc_events_lang_filter(events, chart_reviews, lang_code_for_chart)
        else:
            events_for_chart = events

        fig = create_sentiment_chart(events_for_chart, reverse=False)
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

        # ── 타임라인 (정렬 토글은 여기에) ──
        st.markdown("<div style='height:8px;'></div>", unsafe_allow_html=True)
        col_tl_hdr, col_order = st.columns([5, 3])
        with col_tl_hdr:
            st.markdown(
                """<div style="display:flex;align-items:center;gap:10px;padding:8px 0;">"""
                """<span style="font-size:15px;font-weight:700;color:#1E1E1E;">🗓️ 민심 타임라인</span>"""
                """<span style="font-size:12px;color:#AAAAAA;">패치별 유저 반응 실측 분석</span></div>""",
                unsafe_allow_html=True,
            )
        with col_order:
            order_opt = st.selectbox(
                label="정렬",
                options=["최신순 (위→아래)", "과거순 (위→아래)"],
                key="timeline_order",
                label_visibility="collapsed",
            )
        reverse_order = order_opt.startswith("최신순")

        col_tl, _ = st.columns([8, 2])
        with col_tl:
            display_events = list(reversed(events)) if reverse_order else events
            for i, event in enumerate(display_events):
                render_event_card(event, is_last=(i == len(display_events) - 1))

    else:
        st.markdown("""<div style="background:#FFFFFF;border:1.5px dashed #D5D5D5;border-radius:20px;padding:48px;text-align:center;margin-top:24px;"><div style="font-size:32px;margin-bottom:12px;">⚙️</div><div style="font-size:15px;font-weight:700;color:#1E1E1E;margin-bottom:6px;">타임라인 미생성</div><div style="font-size:13px;color:#757575;word-break:keep-all;margin-bottom:20px;">게임은 등록됐지만 아직 타임라인 분석이 실행되지 않았습니다.</div></div>""",
            unsafe_allow_html=True)
        if is_real_data and sheets_ready():
            col_btn, _ = st.columns([3, 7])
            with col_btn:
                if st.button("⚙️  지금 타임라인 생성하기", key="gen_from_detail"):
                    _run_analysis_pipeline(game)


# ─────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────
def main():
    inject_css()

    if "page" not in st.session_state:
        st.session_state.page = "home"
    if "current_game" not in st.session_state:
        st.session_state.current_game = None

    if st.session_state.page == "home":
        render_home()
    elif st.session_state.page == "game":
        render_game_detail(st.session_state.current_game)


main()
