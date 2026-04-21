"""
평가 급변(Sentiment Shift) AI 분석 모듈

[역할]
 - 급변 구간 리뷰를 Gemini에 전달하여 원인 추정 + 관련 리뷰 선별
 - 근방 공식 이벤트를 타임라인에서 찾아 linked_event_ids 연결
 - 공식 긍정율 이력(rate_history)과 교차검증해 is_official_confirmed 판단

[프롬프트 원칙]
 - 현상 진단 + 인과관계만, 지시적 어조 금지 (gemini_analyzer.py와 동일 원칙)
"""

import json
import re
import time
from datetime import datetime, timedelta

import google.generativeai as genai
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)
MODEL = "gemini-2.5-flash"

_GEN_CONFIG = genai.types.GenerationConfig(response_mime_type="application/json")

SYSTEM_PROMPT = """당신은 Steam 게임 리뷰 분석 전문가입니다.
규칙:
1. 현상 진단과 인과관계 분석만 수행하세요.
2. '권장합니다', '조치가 필요합니다' 등 지시적/주관적 어조를 절대 사용하지 마세요.
3. 데이터에 없는 수치, 가짜 날짜, 가짜 URL을 생성하지 마세요.
4. 응답은 반드시 유효한 JSON으로만 출력하세요. 마크다운 코드블록 없이 순수 JSON."""


# ── 공개 API ──────────────────────────────────────────────────────────────────

def analyze_shift(
    game_name: str,
    shift: dict,
    shift_reviews: list[dict],
    timeline_rows: list[dict],
    rate_history: list[dict] | None = None,
) -> dict:
    """
    급변 이벤트에 대한 AI 분석을 수행하고 shift dict를 업데이트합니다.

    Args:
        game_name:     게임명
        shift:         detect_shifts()가 반환한 급변 이벤트 dict
        shift_reviews: 급변 구간 내 RAW 리뷰 목록 (votes_up 정렬 후 상위 전달 권장)
        timeline_rows: 해당 게임의 전체 타임라인 (공식 이벤트 연결용)
        rate_history:  rate_history 탭 데이터 (공식 긍정율 교차검증용, 없으면 None)

    Returns:
        ai_reaction_summary, top_reviews, linked_event_ids, is_official_confirmed
        필드가 채워진 shift dict 복사본
    """
    result = dict(shift)

    # ── 1. 근방 공식 이벤트 연결 ─────────────────────────────────────────────
    result["linked_event_ids"] = json.dumps(
        _find_linked_events(shift, timeline_rows), ensure_ascii=False
    )

    # ── 2. 공식 긍정율 교차검증 ──────────────────────────────────────────────
    result["is_official_confirmed"] = _check_official_confirmed(shift, rate_history)

    # ── 3. AI 분석 (리뷰가 없으면 생략) ──────────────────────────────────────
    if not shift_reviews:
        result["ai_reaction_summary"] = ""
        result["top_reviews"] = "[]"
        return result

    # votes_up 기준 상위 20건 선별 후 AI 전달
    sorted_reviews = sorted(
        shift_reviews,
        key=lambda r: int(r.get("votes_up", 0)),
        reverse=True,
    )[:20]

    try:
        ai_result = _call_gemini(game_name, shift, sorted_reviews)
        result["ai_reaction_summary"] = ai_result.get("ai_reaction_summary", "")
        result["top_reviews"] = json.dumps(
            ai_result.get("top_reviews", []), ensure_ascii=False
        )
    except Exception as e:
        print(f"[shift_analyzer] Gemini 오류: {e}")
        result["ai_reaction_summary"] = ""
        result["top_reviews"] = "[]"

    return result


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

def _find_linked_events(shift: dict, timeline_rows: list[dict]) -> list[str]:
    """급변 구간 ±14일 내 공식/수동 이벤트의 event_id 목록 반환."""
    try:
        shift_start = datetime.strptime(shift["date"],     "%Y-%m-%d")
        shift_end   = datetime.strptime(shift["date_end"], "%Y-%m-%d")
    except Exception:
        return []

    window_start = shift_start - timedelta(days=14)
    window_end   = shift_end   + timedelta(days=7)  # 급변 이후 패치 대응 포함

    linked = []
    for r in timeline_rows:
        if r.get("event_type") not in ("official", "manual"):
            continue
        if r.get("language_scope") != "all":
            continue
        date_str = r.get("date", "")
        if not date_str:
            continue
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            if window_start <= dt <= window_end:
                linked.append(str(r["event_id"]))
        except Exception:
            continue
    return linked


def _check_official_confirmed(shift: dict, rate_history: list[dict] | None) -> str:
    """
    rate_history에서 급변 전후 공식 긍정율 변화를 확인합니다.
    변화 있으면 "true", 없으면 "false", 데이터 없으면 빈 문자열.
    """
    if not rate_history:
        return ""

    try:
        shift_start = datetime.strptime(shift["date"],     "%Y-%m-%d")
        shift_end   = datetime.strptime(shift["date_end"], "%Y-%m-%d")
    except Exception:
        return ""

    before_window_start = shift_start - timedelta(days=30)
    after_window_end    = shift_end   + timedelta(days=7)

    before_rates, after_rates = [], []
    for row in rate_history:
        date_str = str(row.get("date", "")).strip()
        rate_val = row.get("positive_rate", "")
        if not date_str or rate_val == "":
            continue
        try:
            dt   = datetime.strptime(date_str, "%Y-%m-%d")
            rate = float(rate_val)
        except Exception:
            continue

        if before_window_start <= dt < shift_start:
            before_rates.append(rate)
        elif shift_end < dt <= after_window_end:
            after_rates.append(rate)

    if not before_rates or not after_rates:
        return ""

    before_avg = sum(before_rates) / len(before_rates)
    after_avg  = sum(after_rates)  / len(after_rates)
    delta      = abs(after_avg - before_avg)

    return "true" if delta >= 3.0 else "false"


def _format_reviews(reviews: list[dict]) -> str:
    lines = []
    for i, r in enumerate(reviews, 1):
        v       = r.get("voted_up", False)
        is_pos  = v is True or str(v).upper() == "TRUE"
        lang    = r.get("language", "")
        votes   = int(r.get("votes_up", 0))
        text    = str(r.get("review", ""))[:400]
        lines.append(
            f"[{i}] {'👍' if is_pos else '👎'} lang={lang} votes_up={votes}\n{text}"
        )
    return "\n\n".join(lines)


def _call_gemini(game_name: str, shift: dict, reviews: list[dict], retries: int = 3) -> dict:
    direction_label = "평가 급락" if shift.get("direction") == "decline" else "평가 회복"
    before = shift.get("sentiment_before", "?")
    after  = shift.get("sentiment_rate",   "?")
    delta  = shift.get("sentiment_delta",  0)
    date   = shift.get("date", "")
    end    = shift.get("date_end", "")
    count  = shift.get("review_count", len(reviews))

    reviews_text = _format_reviews(reviews)

    prompt = f"""게임: {game_name}
구간: {date} ~ {end}  ({direction_label})
평가 변화: {before}% → {after}%  (변화폭: {delta:+.1f}pp)
구간 리뷰 수: {count}건

아래는 해당 기간 추천수 상위 리뷰들입니다:

{reviews_text}

JSON으로 응답하세요:
{{
  "ai_reaction_summary": "<급변 원인 추정 150자 이내. 현상/인과관계만, 지시적 어조 금지>",
  "top_reviews": [
    {{
      "text": "<원문 그대로, 최대 300자>",
      "text_kr": "<한국어 번역. 한국어 원문이면 text와 동일>",
      "voted_up": true,
      "language": "<언어코드>"
    }}
  ]
}}

top_reviews 선별 규칙:
- 이슈와 가장 관련 있어 보이는 리뷰 최대 3건
- direction=decline 이면 부정 리뷰 우선, recovery 이면 긍정 리뷰 우선
- votes_up이 높고 이슈를 가장 잘 드러내는 리뷰 선택
- 한국어 원문이면 text_kr = text, 외국어면 반드시 한국어로 번역"""

    model = genai.GenerativeModel(
        MODEL,
        system_instruction=SYSTEM_PROMPT,
        generation_config=_GEN_CONFIG,
    )

    for attempt in range(retries):
        try:
            resp = model.generate_content(prompt)
            raw  = resp.text.strip()
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                m = re.search(r"\{.*\}", raw, re.DOTALL)
                if m:
                    return json.loads(m.group())
                print(f"[shift_analyzer] JSON 파싱 오류 시도 {attempt + 1}")
        except Exception as e:
            print(f"[shift_analyzer] API 오류 시도 {attempt + 1}: {e}")
            if attempt < retries - 1:
                time.sleep(5 * (attempt + 1))
    return {}
