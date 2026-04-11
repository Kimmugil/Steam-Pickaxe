"""
Gemini AI — Steam 리뷰 타임라인 분석 모듈
─────────────────────────────────────────────────────
리뷰 데이터를 월별로 그룹핑한 뒤 Gemini에게 이벤트 탐지를 요청합니다.
"""

import json
import re
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

        # votes_up 기준 상위 3건 샘플
        samples = sorted(revs, key=lambda r: int(r.get("votes_up") or 0), reverse=True)[:3]
        excerpts = []
        for s in samples:
            text = (s.get("review") or "")[:120].replace("\n", " ").strip()
            icon = "👍" if str(s.get("voted_up", "")).lower() in ("true", "1") else "👎"
            if text:
                excerpts.append(f"  {icon} {text}")

        excerpt_str = "\n".join(excerpts) if excerpts else "  (샘플 없음)"
        lines.append(f"[{month}] 리뷰 {len(revs)}건 · 긍정 {pct}%\n{excerpt_str}")

    return "\n\n".join(lines) if lines else "(리뷰 데이터 없음)"


def _build_news_text(news_items: list[dict]) -> str:
    """Steam 뉴스 텍스트를 생성합니다 (프롬프트 삽입용)."""
    if not news_items:
        return "(Steam 뉴스 없음)"
    lines = []
    for item in news_items[:25]:
        ts = item.get("date", 0)
        if ts:
            dt = datetime.fromtimestamp(int(ts), tz=timezone.utc)
            date_str = dt.strftime("%Y-%m-%d")
        else:
            date_str = "날짜미상"
        title = (item.get("title") or "").strip()
        lines.append(f"- {date_str}: {title}")
    return "\n".join(lines)


def analyze_reviews_to_timeline(
    game_name: str,
    release_date: str,
    total_reviews: int,
    reviews: list[dict],
    steam_news: list[dict],
) -> list[dict]:
    """
    Steam 리뷰 + 뉴스를 분석하여 타임라인 이벤트 리스트를 반환합니다.

    Args:
        game_name: 게임명
        release_date: 출시일 (YYYY-MM-DD 또는 Steam 형식)
        total_reviews: Steam 전체 리뷰 수 (실제 총계)
        reviews: 수집된 리뷰 리스트 (Steam API 원본 형식)
        steam_news: Steam 뉴스 리스트

    Returns:
        이벤트 dict 리스트 (sheets_manager.TIMELINE_COLUMNS 스키마 포함)
    """
    api_key = get_env("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY가 설정되지 않았습니다.")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(MODEL_NAME)

    monthly_groups = _group_by_month(reviews)
    monthly_text   = _build_monthly_text(monthly_groups)
    news_text      = _build_news_text(steam_news)

    prompt = f"""당신은 Steam 게임 리뷰 분석 전문가입니다.
아래 데이터를 분석하여 게임의 주요 이벤트 타임라인을 JSON으로 생성해주세요.

## 게임 정보
- 게임명: {game_name}
- 출시일: {release_date}
- Steam 총 리뷰 수: {total_reviews:,}건
- 이번 분석 리뷰: {len(reviews)}건 (초기 샘플)

## Steam 공식 뉴스 / 패치노트 (최신 25개)
{news_text}

## 월별 리뷰 통계 및 샘플
{monthly_text}

## 분석 지시사항
1. 5~8개의 주요 이벤트를 시간순(오래된 것 먼저)으로 식별하세요.
2. 이벤트 유형:
   - launch: 게임 출시 (반드시 1개)
   - update: 주요 업데이트/DLC/시즌
   - crisis: 급격한 부정 반응 급증
   - controversy: 정책/운영 논란
   - recovery: 반등/개선
3. sentiment_pct는 해당 기간의 리뷰 데이터 기반으로 계산하세요.
4. key_issues는 3개 이내, 한국어로 작성하세요.
5. top_langs는 해당 기간 리뷰에서 많이 쓰인 언어 2~3개.

## 출력 형식 (JSON 배열만 출력, 설명 텍스트 없이)
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
    "kr_summary": "한국어 유저 반응 요약 (60자 이내)"
  }}
]"""

    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            temperature=0.3,
            max_output_tokens=4096,
        ),
    )

    raw = response.text.strip()

    # JSON 블록 추출 (```json ... ``` 또는 [ ... ] 형태 모두 처리)
    json_match = re.search(r"\[.*?\]", raw, re.DOTALL)
    if not json_match:
        raise ValueError(f"Gemini 응답에서 JSON 배열을 찾을 수 없습니다.\n응답 앞부분: {raw[:300]}")

    events_raw: list[dict] = json.loads(json_match.group())

    now_iso = datetime.now(timezone.utc).isoformat()
    events = []
    for i, e in enumerate(events_raw, start=1):
        event_type = e.get("type", "update")
        date_str   = e.get("date", "")
        period_end = e.get("period_end", "")

        events.append({
            "event_id":    f"evt_{i:03d}",
            "name":        e.get("name", ""),
            "date":        date_str,
            "period_end":  period_end,
            "type":        event_type,
            "type_label":  EVENT_TYPE_LABELS.get(event_type, event_type),
            "sentiment_pct": int(e.get("sentiment_pct") or 50),
            "review_count":  int(e.get("review_count") or 0),
            "description": e.get("description", ""),
            "key_issues":  e.get("key_issues", []),
            "top_langs":   e.get("top_langs", []),
            "kr_summary":  e.get("kr_summary", ""),
            "color":       EVENT_COLORS.get(event_type, "#E0E0E0"),
            "user_edited": False,
            "created_at":  now_iso,
            "updated_at":  now_iso,
        })

    return events
