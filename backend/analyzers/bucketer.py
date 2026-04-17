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
        today = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
        launch_id = str(uuid.uuid4())
        return [{
            "event_id": launch_id,
            "event_type": "launch",
            "date": "",
            "title": "런칭~현재",
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
    기획서 AI 샘플링 전략:
    votes_up+votes_funny 상위 1000건 + 최신순 1000건 혼합 (최대 2000건)
    """
    sorted_by_votes = sorted(
        reviews,
        key=lambda r: int(r.get("votes_up", 0)) + int(r.get("votes_funny", 0)),
        reverse=True,
    )
    sorted_by_time = sorted(reviews, key=lambda r: int(r.get("timestamp_created", 0)), reverse=True)

    seen = set()
    sampled = []
    for r in sorted_by_votes[:top_votes] + sorted_by_time[:latest]:
        rid = r.get("recommendationid", id(r))
        if rid not in seen:
            seen.add(rid)
            sampled.append(r)
        if len(sampled) >= max_total:
            break
    return sampled
