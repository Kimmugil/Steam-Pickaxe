"""
Gemini AI — Steam 리뷰 타임라인 분석 모듈
─────────────────────────────────────────────────────
리뷰 데이터를 월별로 그룹핑한 뒤 Gemini에게 이벤트 탐지를 요청합니다.
"""

import json
import re
import uuid as _uuid_mod
from collections import defaultdict
from datetime import datetime, timezone

import google.generativeai as genai

from .config import get_env

MODEL_NAME = "gemini-2.5-flash"

EVENT_COLORS = {
    "launch":       "#C8E6C9",
    "update":       "#BBDEFB",
    "crisis":       "#FFCDD2",
    "controversy":  "#FFE0B2",
    "recovery":     "#E1BEE7",
}

EVENT_TYPE_LABELS = {
    "launch":       "출시",
    "update":       "업데이트",
    "crisis":       "위기",
    "controversy":  "논란",
    "recovery":     "회복",
}


# ─────────────────────────────────────────────
#  내부 유틸리티
# ─────────────────────────────────────────────
def _group_by_month(reviews: list[dict]) -> dict[str, list[dict]]:
    """리뷰를 YYYY-MM 키로 정렬 그룹핑합니다."""
    groups: dict[str, list] = defaultdict(list)
    for rev in reviews:
        ts = int(rev.get("timestamp_created") or 0)
        if ts:
            dt = datetime.fromtimestamp(ts, tz=timezone.utc)
            groups[dt.strftime("%Y-%m")].append(rev)
    return dict(sorted(groups.items()))


def _build_monthly_text(groups: dict[str, list]) -> str:
    """월별 통계 + 샘플 리뷰 텍스트를 생성합니다 (프롬프트 삽입용)."""
    lines = []
    for month, revs in groups.items():
        pos = sum(
            1 for r in revs
            if str(r.get("voted_up", "")).lower() in ("true", "1")
        )
        pct = round(pos / len(revs) * 100) if revs else 0
        samples = sorted(revs, key=lambda r: int(r.get("votes_up") or 0), reverse=True)[:3]
        excerpts = []
        for s in samples:
            text = (s.get("review") or "")[:120].replace("\n", " ").strip()
            icon = "👍" if str(s.get("voted_up", "")).lower() in ("true", "1") else "👎"
            if text:
                excerpts.append(f"  {icon} [{s.get('language','?')}] {text}")
        excerpt_str = "\n".join(excerpts) if excerpts else "  (샘플 없음)"
        lines.append(f"[{month}] 리뷰 {len(revs)}건 · 긍정 {pct}%\n{excerpt_str}")
    return "\n\n".join(lines) if lines else "(리뷰 데이터 없음)"


def _build_news_text(news_items: list[dict]) -> tuple[str, dict[int, str]]:
    """
    Steam 뉴스 텍스트(번호 포함)와 {번호: URL} 매핑을 반환합니다.
    """
    if not news_items:
        return "(Steam 뉴스 없음)", {}
    lines = []
    url_map: dict[int, str] = {}
    for i, item in enumerate(news_items[:25], start=1):
        ts = item.get("date", 0)
        if ts:
            dt = datetime.fromtimestamp(int(ts), tz=timezone.utc)
            date_str = dt.strftime("%Y-%m-%d")
        else:
            date_str = "날짜미상"
        title = (item.get("title") or "").strip()
        url   = (item.get("url") or "").strip()
        url_map[i] = url
        lines.append(f"[{i}] {date_str}: {title}")
    return "\n".join(lines), url_map


def _get_top_reviews_for_period(
    reviews: list[dict],
    date_start: str,
    date_end: str,
    n: int = 2,
) -> list[dict]:
    """기간에 해당하는 상위 리뷰 n건을 반환합니다."""
    try:
        start_ts = int(datetime.fromisoformat(date_start + "T00:00:00+00:00").timestamp())
        end_ts   = int(datetime.fromisoformat(date_end   + "T23:59:59+00:00").timestamp())
    except Exception:
        return []
    period = [
        r for r in reviews
        if start_ts <= int(r.get("timestamp_created") or 0) <= end_ts
    ]
    top = sorted(period, key=lambda r: int(r.get("votes_up") or 0), reverse=True)[:n]
    result = []
    for r in top:
        text = (r.get("review") or "").replace("\n", " ").strip()
        if text:
            result.append({
                "text":     text[:300],
                "language": r.get("language", ""),
                "voted_up": str(r.get("voted_up", "")).lower() in ("true", "1"),
                "votes_up": int(r.get("votes_up") or 0),
            })
    return result


def _calc_actual_stats(
    reviews: list[dict],
    date_start: str,
    date_end: str,
) -> tuple[int, int | None]:
    """기간의 실제 리뷰 수와 긍정 비율을 계산합니다."""
    try:
        start_ts = int(datetime.fromisoformat(date_start + "T00:00:00+00:00").timestamp())
        end_ts   = int(datetime.fromisoformat(date_end   + "T23:59:59+00:00").timestamp())
    except Exception:
        return 0, None
    period = [
        r for r in reviews
        if start_ts <= int(r.get("timestamp_created") or 0) <= end_ts
    ]
    if not period:
        return 0, None
    pos = sum(1 for r in period if str(r.get("voted_up", "")).lower() in ("true", "1"))
    return len(period), round(pos / len(period) * 100)


def _sanitize_json(text: str) -> str:
    text = re.sub(r",\s*}", "}", text)
    text = re.sub(r",\s*]", "]", text)
    return text


def _parse_json_array(raw: str) -> list[dict]:
    """Gemini 응답 텍스트에서 JSON 배열을 추출합니다."""
    # 1. ```json ... ``` 코드 블록
    code_match = re.search(r"```(?:json)?\s*(\[[\s\S]*?\])\s*```", raw)
    if code_match:
        try:
            return json.loads(code_match.group(1))
        except json.JSONDecodeError:
            pass

    # 2. 전체 응답이 JSON 배열
    try:
        result = json.loads(raw)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        pass

    # 3. 첫 번째 [ 부터 마지막 ] 까지 greedy 추출
    start = raw.find("[")
    end   = raw.rfind("]")
    if start != -1 and end != -1 and end > start:
        candidate = raw[start : end + 1]
        for attempt in (candidate, _sanitize_json(candidate)):
            try:
                return json.loads(attempt)
            except json.JSONDecodeError:
                pass
        try:
            return json.loads(candidate)
        except json.JSONDecodeError as e:
            raise ValueError(
                f"JSON 파싱 실패: {e}\n"
                f"추출된 텍스트 앞부분: {candidate[:400]}"
            )

    raise ValueError(f"JSON 배열을 찾을 수 없습니다.\n응답 앞부분: {raw[:300]}")


# ─────────────────────────────────────────────
#  메인 분석 함수
# ─────────────────────────────────────────────
def analyze_reviews_to_timeline(
    game_name: str,
    release_date: str,
    total_reviews: int,
    reviews: list[dict],
    steam_news: list[dict],
) -> tuple[list[dict], str]:
    """
    Steam 리뷰 + 뉴스를 분석하여 (이벤트 리스트, 생성 UUID) 를 반환합니다.

    Returns:
        (events, gen_uuid)
        events: sheets_manager.TIMELINE_COLUMNS 스키마에 맞는 이벤트 dict 리스트
        gen_uuid: 이번 생성의 8자 UUID
    """
    api_key = get_env("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY가 설정되지 않았습니다.")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(MODEL_NAME)

    monthly_groups        = _group_by_month(reviews)
    monthly_text          = _build_monthly_text(monthly_groups)
    news_text, url_map    = _build_news_text(steam_news)
    gen_uuid              = str(_uuid_mod.uuid4())[:8].upper()

    prompt = f"""당신은 Steam 게임 리뷰 분석 전문가입니다.
아래 데이터를 분석하여 게임의 주요 이벤트 타임라인을 JSON으로 생성해주세요.

## 게임 정보
- 게임명: {game_name}
- 출시일: {release_date}
- Steam 총 리뷰 수: {total_reviews:,}건
- 이번 분석 리뷰: {len(reviews)}건 (초기 샘플)

## Steam 공식 뉴스 / 패치노트 (번호 포함, 최신 25개)
{news_text}

## 월별 리뷰 통계 및 샘플
{monthly_text}

## 분석 지시사항
1. 5~8개의 주요 이벤트를 시간순(오래된 것 먼저)으로 식별하세요.
2. 이벤트 유형: launch(출시, 반드시 1개), update(업데이트/DLC/시즌), crisis(부정 급증), controversy(정책/운영 논란), recovery(반등/회복)
3. sentiment_pct: 해당 기간 리뷰 기반 긍정 비율. null 금지, 추정값이라도 숫자.
4. review_count: 해당 기간 리뷰 수. null 금지, 추정값이라도 숫자.
5. source_news_index: 이 이벤트의 근거가 되는 위 뉴스 번호(정수). 없으면 0.
6. key_issues: 3개 이내, 한국어로.
7. top_langs: 해당 기간 주요 언어 2~3개.
8. kr_summary: 한국어 유저의 주요 반응 요약 (60자 이내).
9. 모든 문자열에 쌍따옴표(") 사용 금지. 필요시 홑따옴표(') 사용.

## 출력 형식 (JSON 배열만, 설명 텍스트 없이)
[
  {{
    "name": "이벤트명 (15자 이내)",
    "date": "YYYY-MM-DD",
    "period_end": "YYYY-MM-DD",
    "type": "launch",
    "sentiment_pct": 75,
    "review_count": 150,
    "description": "이벤트 설명 (120자 이내, 한국어)",
    "key_issues": ["이슈1", "이슈2"],
    "top_langs": ["한국어", "영어"],
    "kr_summary": "한국어 유저 반응 요약",
    "source_news_index": 3
  }}
]"""

    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            temperature=0.3,
            max_output_tokens=8192,
            response_mime_type="application/json",
        ),
    )

    events_raw: list[dict] = _parse_json_array(response.text.strip())

    now_iso = datetime.now(timezone.utc).isoformat()
    events  = []

    for i, e in enumerate(events_raw, start=1):
        event_type = e.get("type", "update")
        date_str   = e.get("date", "")
        period_end = e.get("period_end", "")

        # 실제 데이터 기반 통계 계산 (Gemini 추정 보정)
        actual_count, actual_pct = _calc_actual_stats(reviews, date_str, period_end)
        review_count  = actual_count if actual_count > 0 else (int(e.get("review_count") or 0) if e.get("review_count") is not None else 0)
        sentiment_pct = actual_pct   if actual_pct  is not None else (int(e.get("sentiment_pct") or 50) if e.get("sentiment_pct") is not None else 50)

        # 패치노트 URL 해석
        src_idx    = int(e.get("source_news_index") or 0)
        source_url = url_map.get(src_idx, "")

        # 해당 기간 상위 리뷰 추출
        top_reviews = _get_top_reviews_for_period(reviews, date_str, period_end)

        events.append({
            "event_id":        f"evt_{i:03d}",
            "name":            e.get("name", ""),
            "date":            date_str,
            "period_end":      period_end,
            "type":            event_type,
            "type_label":      EVENT_TYPE_LABELS.get(event_type, event_type),
            "sentiment_pct":   sentiment_pct,
            "review_count":    review_count,
            "description":     e.get("description", ""),
            "key_issues":      e.get("key_issues", []),
            "top_langs":       e.get("top_langs", []),
            "kr_summary":      e.get("kr_summary", ""),
            "color":           EVENT_COLORS.get(event_type, "#E0E0E0"),
            "user_edited":     False,
            "source_url":      source_url,
            "top_reviews":     top_reviews,
            "generation_uuid": gen_uuid,
            "created_at":      now_iso,
            "updated_at":      now_iso,
        })

    return events, gen_uuid
