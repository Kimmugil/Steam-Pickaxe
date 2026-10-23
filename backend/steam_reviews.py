"""Steam 리뷰 요청과 변환. 계정 ID·닉네임 같은 개인정보는 읽지도 저장하지도 않습니다."""
from datetime import datetime

from common import UTC, get_json

REVIEWS_URL = "https://store.steampowered.com/appreviews/{appid}"
PAGE_SIZE = 100  # Steam이 허용하는 최대값


def fetch_page(appid: int, cursor: str = "*", per_page: int = PAGE_SIZE) -> dict | None:
    params = {"json": 1, "filter": "recent", "language": "all", "purchase_type": "all",
              "num_per_page": per_page, "cursor": cursor}
    d = get_json(REVIEWS_URL.format(appid=appid), params)
    return d if d and d.get("success") == 1 else None


def fetch_summary(appid: int) -> dict | None:
    """리뷰를 1건만 요청해서 전체 리뷰 수·긍정/부정 수(query_summary)만 얻습니다. (점검용, 요청 1번)"""
    d = fetch_page(appid, "*", per_page=1)
    return (d or {}).get("query_summary")


def _ts(v):
    try:
        v = int(v)
    except (TypeError, ValueError):
        return None
    return datetime.fromtimestamp(v, tz=UTC) if v > 0 else None


def _int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def parse_review(r: dict, appid: int, observed_at: datetime) -> dict | None:
    """Steam 리뷰 한 건 → DB 한 줄. 필수 값이 없으면 None."""
    try:
        rid = int(r["recommendationid"])
        created = _ts(r["timestamp_created"])
        voted_up = bool(r["voted_up"])
    except (KeyError, TypeError, ValueError):
        return None
    if created is None:
        return None
    a = r.get("author") or {}
    try:
        wvs = float(r.get("weighted_vote_score")) if r.get("weighted_vote_score") is not None else None
    except (TypeError, ValueError):
        wvs = None
    return {
        "appid": appid,
        "recommendationid": rid,
        "voted_up": voted_up,
        "language": r.get("language"),
        "review": (r.get("review") or "").replace("\x00", ""),
        "created_at": created,
        "updated_at": _ts(r.get("timestamp_updated")),
        "playtime_at_review": _int(a.get("playtime_at_review")),
        "playtime_forever": _int(a.get("playtime_forever")),
        "playtime_last_two_weeks": _int(a.get("playtime_last_two_weeks")),
        "last_played": _ts(a.get("last_played")),
        "votes_up": _int(r.get("votes_up")) or 0,
        "weighted_vote_score": wvs,
        "steam_purchase": r.get("steam_purchase"),
        "received_for_free": r.get("received_for_free"),
        "written_during_early_access": r.get("written_during_early_access"),
        "refunded": r.get("refunded"),
        "observed_at": observed_at,
    }


UPSERT_SQL = """
insert into reviews (appid, recommendationid, voted_up, language, review, created_at, updated_at,
                     playtime_at_review, playtime_forever, playtime_last_two_weeks, last_played, votes_up,
                     weighted_vote_score, steam_purchase, received_for_free, written_during_early_access,
                     refunded, observed_at)
values (%(appid)s, %(recommendationid)s, %(voted_up)s, %(language)s, %(review)s, %(created_at)s, %(updated_at)s,
        %(playtime_at_review)s, %(playtime_forever)s, %(playtime_last_two_weeks)s, %(last_played)s, %(votes_up)s,
        %(weighted_vote_score)s, %(steam_purchase)s, %(received_for_free)s, %(written_during_early_access)s,
        %(refunded)s, %(observed_at)s)
on conflict (appid, recommendationid) do update set
  voted_up = excluded.voted_up, language = excluded.language, review = excluded.review,
  updated_at = excluded.updated_at, playtime_at_review = excluded.playtime_at_review,
  playtime_forever = excluded.playtime_forever, playtime_last_two_weeks = excluded.playtime_last_two_weeks,
  last_played = excluded.last_played, votes_up = excluded.votes_up,
  weighted_vote_score = excluded.weighted_vote_score, steam_purchase = excluded.steam_purchase,
  received_for_free = excluded.received_for_free,
  written_during_early_access = excluded.written_during_early_access,
  refunded = excluded.refunded, observed_at = excluded.observed_at
"""
