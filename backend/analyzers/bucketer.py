"""
시계열 버킷팅 — 이벤트 기준으로 리뷰 구간 분할
기획서 4장: [이벤트N 00:00:00] ~ [이벤트N+1 전날 23:59:59]
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid


def _to_ts(date_str: str, end_of_day: bool = False) -> int:
    """YYYY-MM-DD 문자열 → UTC 타임스탬프 (초)"""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        if end_of_day:
            dt = dt + timedelta(days=1) - timedelta(seconds=1)
        return int(dt.timestamp())
    except Exception:
        return 0


def build_buckets(events: list[dict]) -> list[dict]:
    """
    events: timeline_{appid}에서 language_scope=all 행 중 이벤트 목록
    각 이벤트 = {"event_id", "event_type", "date", "title", ...}
    반환: 버킷 목록 [{"event_id", "start_ts", "end_ts", ...}]
    """
    officials = [e for e in events if e.get("event_type") in ("official", "manual")]
    officials.sort(key=lambda e: (e.get("date", ""), e.get("event_id", "")))

    if not officials:
        # event_id를 고정값으로 사용해 analyze 재실행 시 중복 행 생성 방지
        return [{
            "event_id": "launch_bucket",
            "event_type": "launch",
            "date": "",
            "title": "런칭",
            "start_ts": 0,
            "end_ts": int(datetime.now(tz=timezone.utc).timestamp()),
        }]

    buckets = []
    for i, ev in enumerate(officials):
        start_ts = _to_ts(ev.get("date", ""), end_of_day=False)
        if i + 1 < len(officials):
            next_date = officials[i + 1].get("date", "")
            end_ts = _to_ts(next_date, end_of_day=True) - 86400
        else:
            end_ts = int(datetime.now(tz=timezone.utc).timestamp())

        buckets.append({
            "event_id": ev.get("event_id"),
            "event_type": ev.get("event_type"),
            "date": ev.get("date"),
            "title": ev.get("title"),
            "url": ev.get("url", ""),
            "is_sale_period": ev.get("is_sale_period", False),
            "sale_text": ev.get("sale_text", ""),
            "is_free_weekend": ev.get("is_free_weekend", False),
            "content": ev.get("content", ""),   # 이벤트 본문 — AI 패치 요약에 사용
            "start_ts": start_ts,
            "end_ts": end_ts,
        })
    return buckets


def split_bucket(buckets: list[dict], split_date: str, new_event_id: str,
                 new_title: str, new_type: str = "manual") -> list[dict]:
    """
    수동 이벤트 등록 시 기존 버킷을 날짜 기준으로 2개로 분할
    """
    split_ts = _to_ts(split_date)
    new_buckets = []
    for b in buckets:
        if b["start_ts"] < split_ts <= b["end_ts"]:
            before = dict(b)
            before["end_ts"] = split_ts - 1

            after = {
                "event_id": new_event_id,
                "event_type": new_type,
                "date": split_date,
                "title": new_title,
                "url": "",
                "is_sale_period": False,
                "sale_text": "",
                "is_free_weekend": False,
                "start_ts": split_ts,
                "end_ts": b["end_ts"],
            }
            new_buckets.append(before)
            new_buckets.append(after)
        else:
            new_buckets.append(b)
    return new_buckets


def filter_reviews_for_bucket(reviews: list[dict], start_ts: int, end_ts: int) -> list[dict]:
    return [r for r in reviews if start_ts <= int(r.get("timestamp_created", 0)) <= end_ts]


def sample_reviews(reviews: list[dict], max_total: int = 2000,
                   top_votes: int = 1000, latest: int = 1000) -> list[dict]:
    """
    계층 샘플링 (Stratified Sampling) — 긍정/부정 비율 보존

    전체 리뷰의 실제 긍정/부정 비율을 계산한 뒤,
    각 그룹에서 votes+recency 기반으로 후보를 선정하고
    원래 비율에 맞게 max_total건 샘플링합니다.

    효과: 예) 전체 90% 긍정 게임의 샘플이 60% 긍정으로 왜곡되는 현상 제거
    → Gemini의 sentiment_rate 계산 정확도 향상
    """
    if not reviews:
        return []
    if len(reviews) <= max_total:
        return reviews

    def _is_positive(r: dict) -> bool:
        v = r.get("voted_up", False)
        return v is True or str(v).upper() == "TRUE"

    positives = [r for r in reviews if _is_positive(r)]
    negatives  = [r for r in reviews if not _is_positive(r)]

    # 실제 긍정률 계산
    true_pos_rate = len(positives) / len(reviews) if reviews else 0.5

    # 각 그룹에서 votes+recency 기반 후보 선정
    def _select(pool: list[dict], quota: int) -> list[dict]:
        if not pool:
            return []
        by_votes = sorted(pool, key=lambda r: int(r.get("votes_up", 0)) + int(r.get("votes_funny", 0)), reverse=True)
        by_time  = sorted(pool, key=lambda r: int(r.get("timestamp_created", 0)), reverse=True)
        seen, result = set(), []
        for r in by_votes[:top_votes] + by_time[:latest]:
            rid = r.get("recommendationid", id(r))
            if rid not in seen:
                seen.add(rid)
                result.append(r)
            if len(result) >= quota:
                break
        return result

    pos_quota = round(max_total * true_pos_rate)
    neg_quota = max_total - pos_quota

    sampled = _select(positives, pos_quota) + _select(negatives, neg_quota)

    # 한 그룹이 할당량 미달이면 다른 그룹에서 보충
    if len(sampled) < max_total:
        shortfall = max_total - len(sampled)
        sampled_ids = {r.get("recommendationid", id(r)) for r in sampled}
        extras = [r for r in reviews if r.get("recommendationid", id(r)) not in sampled_ids]
        sampled += extras[:shortfall]

    return sampled
