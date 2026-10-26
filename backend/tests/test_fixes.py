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
