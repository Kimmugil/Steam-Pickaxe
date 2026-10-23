"""리뷰 변환이 Steam 실제 응답 모양과 맞는지 확인하는 시험.  python backend/tests/test_parse.py"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from common import now_utc
from steam_reviews import parse_review

# 2026-10에 Steam이 실제로 준 응답 모양 (닉네임·계정 ID는 일부러 가짜 값)
SAMPLE = {
    "recommendationid": "238282796",
    "author": {"steamid": "0", "personaname": "x", "num_games_owned": 0, "num_reviews": 1,
               "playtime_forever": 138, "playtime_last_two_weeks": 0, "playtime_at_review": 138, "last_played": 1785788610},
    "language": "spanish", "review": "la verdad se me hizo aburrido \x00",
    "timestamp_created": 1792644543, "timestamp_updated": 1792644543, "voted_up": False, "votes_up": 0, "votes_funny": 0,
    "weighted_vote_score": 0.5, "comment_count": 0, "steam_purchase": True, "received_for_free": False,
    "refunded": False, "written_during_early_access": False,
}

r = parse_review(SAMPLE, 1623730, now_utc())
assert r["recommendationid"] == 238282796 and r["appid"] == 1623730
assert r["playtime_forever"] == 138 and r["playtime_at_review"] == 138, "플레이타임이 author 안쪽에서 읽혀야 합니다"
assert r["last_played"] is not None and r["last_played"].year >= 2026, "마지막 접속 시각이 읽혀야 합니다"
assert r["voted_up"] is False and r["steam_purchase"] is True and r["written_during_early_access"] is False
assert "\x00" not in r["review"], "널 문자는 제거되어야 합니다"
assert not any(k in r for k in ("steamid", "personaname", "profile_url")), "개인정보는 저장하지 않습니다"
assert parse_review({"recommendationid": "1"}, 1, now_utc()) is None, "필수 값이 없으면 건너뜁니다"
bad = dict(SAMPLE, author={"playtime_forever": 0, "last_played": 0})
assert parse_review(bad, 1, now_utc())["last_played"] is None, "last_played 0은 '알 수 없음'으로 처리"
print("변환 시험 통과: 플레이타임·마지막 접속·플래그 읽기 OK, 개인정보 제외 OK")
