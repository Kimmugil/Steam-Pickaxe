"""
시계열 버킷팅 — 이벤트 기준 / 월 단위 리뷰 구간 분할
"""
from datetime import datetime, timezone, timedelta
from calendar import monthrange
from typing import Optional


def _to_ts(date_str: str, end_of_day: bool = False) -> int:
    """YYYY-MM-DD 문자열 → UTC 타임스탬프 (초)"""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        if end_of_day:
            dt = dt + timedelta(days=1) - timedelta(seconds=1)
        return int(dt.timestamp())
    except Exception:
        return 0



def build_monthly_buckets(timeline_events: list[dict],
                          release_date: Optional[str] = None) -> list[dict]:
    """
    타임라인 이벤트를 YYYY-MM 단위로 묶어 월별 버킷을 반환합니다.
    release_date가 제공되면 출시 월부터 현재 월까지 모든 월을 포함합니다.

    반환: [
      {
        "year_month":       "2025-04",
        "event_id":         "monthly_2025_04",
        "date":             "2025-04-01",
        "title":            "2025년 04월",
        "start_ts":         ...,
        "end_ts":           ...,
        "official_events":  [...],
        "all_events":       [...],
        "is_current_month": bool,
      }, ...
    ]
    """
    now = datetime.now(tz=timezone.utc)
    current_ym = now.strftime("%Y-%m")

    # language_scope=all 행만 사용하고, monthly_summary 행은 제외
    events = [
        e for e in timeline_events
        if e.get("language_scope") == "all"
        and e.get("event_type") != "monthly_summary"
    ]

    # YYYY-MM으로 그룹화
    month_events: dict[str, list[dict]] = {}
    for ev in events:
        date_str = str(ev.get("date", "")).strip()
        if not date_str or len(date_str) < 7:
            continue
        ym = date_str[:7]
        month_events.setdefault(ym, []).append(ev)

    # 출시 월부터 현재 월까지 빈 버킷 보장
    if release_date:
        try:
            release_ym = str(release_date).strip()[:7]
            if len(release_ym) == 7 and release_ym[4] == "-":
                # release_ym ~ current_ym 사이 모든 월 추가
                ry, rm = int(release_ym[:4]), int(release_ym[5:7])
                cy, cm = int(current_ym[:4]), int(current_ym[5:7])
                y, m = ry, rm
                while (y, m) <= (cy, cm):
                    ym_key = f"{y:04d}-{m:02d}"
                    month_events.setdefault(ym_key, [])
                    m += 1
                    if m > 12:
                        m = 1
                        y += 1
        except Exception:
            pass

    # 이벤트가 없거나 현재 월이 없으면 현재 월 빈 버킷 추가
    if not month_events or current_ym not in month_events:
        month_events.setdefault(current_ym, [])

    buckets = []
    for ym in sorted(month_events.keys()):
        year, month = int(ym[:4]), int(ym[5:7])
        _, last_day = monthrange(year, month)

        start_dt = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
        is_current = (ym == current_ym)
        end_dt = now if is_current else datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)

        month_evs = sorted(
            month_events[ym],
            key=lambda e: (e.get("date", ""), e.get("event_id", "")),
        )
        official_evs = [e for e in month_evs if e.get("event_type") in ("official", "manual")]

        buckets.append({
            "year_month":       ym,
            "event_id":         f"monthly_{ym.replace('-', '_')}",
            "date":             f"{ym}-01",
            "title":            f"{year}년 {month:02d}월",
            "start_ts":         int(start_dt.timestamp()),
            "end_ts":           int(end_dt.timestamp()),
            "official_events":  official_evs,
            "all_events":       month_evs,
            "is_current_month": is_current,
        })

    return buckets


def filter_reviews_for_bucket(reviews: list[dict], start_ts: int, end_ts: int) -> list[dict]:
    return [r for r in reviews if start_ts <= int(r.get("timestamp_created", 0)) <= end_ts]


def sample_reviews(reviews: list[dict], max_total: int = 500,
                   top_votes: int = 300, latest: int = 300) -> list[dict]:
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
