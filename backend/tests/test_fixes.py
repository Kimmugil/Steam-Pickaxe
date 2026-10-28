"""2026-10 점검에서 찾은 두 가지 문제가 다시 생기지 않는지 확인.  python backend/tests/test_fixes.py"""
import os
import sys
import types

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import steam_reviews

# 1) 목록의 끝에 닿으면 Steam은 'reviews' 없이 요약만 줍니다. 차단이 아니라 '더 없음'으로 읽어야 함
steam_reviews.get_json = lambda url, params=None, **k: {"response": {"query_summary": {"num_reviews": 0}, "cursor": "abc", "total_matching": 10}}
r = steam_reviews.fetch_page(1, "abc")
assert r is not None and r["reviews"] == [], "끝에 닿은 응답은 빈 목록이어야 합니다 (None 이면 차단으로 오해함)"
steam_reviews.get_json = lambda url, params=None, **k: {"response": {}}
assert steam_reviews.fetch_page(1, "abc") is None, "내용 없는 응답은 여전히 실패로 처리"
steam_reviews.get_json = lambda url, params=None, **k: None
assert steam_reviews.fetch_page(1, "abc") is None

# 2) Gemini가 문자열 안에 줄바꿈·제어 문자를 그대로 넣어도 읽어야 함 (google 패키지 없이 시험하려고 가짜로 대체)
g = types.ModuleType("google.genai"); g.types = types.ModuleType("google.genai.types")
google = types.ModuleType("google"); google.genai = g
sys.modules.update({"google": google, "google.genai": g, "google.genai.types": g.types})
import gemini  # noqa: E402

assert gemini._parse('{"a": "줄1\n줄2\t끝"}')["a"].startswith("줄1")
assert gemini._parse('```json\n{"a": "x\x01y"}\n```')["a"] == "x\x01y"
print("수정 확인 시험 통과: 목록 끝 처리, 제어 문자 JSON 읽기")

# 3) 진단: 활동 감소는 '이 게임이 평소 줄어들던 만큼'을 뺀 뒤에 판단한다
import sys as _s, types as _t
from datetime import date, timedelta
import metrics

today = date(2026, 10, 28)
def days_for(monthly):                       # monthly[k] = k+1 번째 직전 30일 창(k=0이 직전 30일)의 하루 평균 (긍정, 부정)
    d = {}
    for k, (p, n) in enumerate(monthly):
        for i in range(1 + 30 * k, 31 + 30 * k):
            d[today - timedelta(days=i)] = (p, n)
    return d
# 평소 매달 40%씩 줄어드는 게임: 옛 창일수록 리뷰가 많다 (가까운 창 5건/일 → 그 전 8.3 → 13.9 ...) (긍정 90%)
steady = [(round(5 * (1 / 0.6) ** k * 0.9 * 10), round(5 * (1 / 0.6) ** k * 0.1 * 10)) for k in range(7)]
h = metrics.own_history(days_for(steady), today)
assert -45 < h["velocity_drift"] < -35, h
base = {"pos30": 90.0, "steam_positive_rate": 90.0, "ccu_change": None, **h}
assert metrics.diagnose("mid", dict(base, velocity_change=-40.0))[0] == "healthy", "평소대로 줄어드는 건 감소가 아님"
assert metrics.diagnose("mid", dict(base, velocity_change=-80.0))[0] == "quiet", "평소보다 훨씬 빠르게 줄면 감소"
short = {"pos30": 90.0, "steam_positive_rate": 90.0, "ccu_change": None, "velocity_change": -20.0, "velocity_drift": None, "velocity_noise": None}
assert metrics.diagnose("mid", short)[0] == "quiet", "기록이 짧으면 고정 기준(-15%)"
print("진단 시험 통과: 평소 흐름 반영")
