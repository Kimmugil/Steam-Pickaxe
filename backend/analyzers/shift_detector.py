"""
평가 급변(Sentiment Shift) 감지 알고리즘

[원리]
 - 날짜별 긍/부정 집계 → 7일 롤링 긍정율 vs 30일 기준선 비교
 - 변화폭이 threshold 초과 시 해당 날짜를 "트리거" 상태로 마킹
 - 인접 트리거 날짜(3일 이내)를 하나의 구간으로 병합
 - 게임 리뷰 볼륨에 따라 threshold / 최소 리뷰 수 자동 조정

[반환]
 - 감지된 구간 리스트 (timeline row 형식 dict, AI 분석 전 상태)
"""

import uuid
from datetime import datetime, timedelta
from collections import defaultdict


# ── 볼륨별 감지 파라미터 ──────────────────────────────────────────────────────

def _adaptive_params(avg_monthly_reviews: float) -> tuple[int, float]:
    """(최소 구간 리뷰 수, 변화폭 threshold_pp) 반환."""
    if avg_monthly_reviews >= 500:
        return 20, 10.0
    elif avg_monthly_reviews >= 100:
        return 15, 15.0
    else:
        return 10, 25.0


def _confidence(review_count: int) -> str:
    if review_count >= 50:
        return "high"
    elif review_count >= 20:
        return "medium"
    return "low"


# ── 메인 감지 함수 ────────────────────────────────────────────────────────────

def detect_shifts(
    reviews: list[dict],
    existing_shift_dates: set[str] | None = None,
) -> list[dict]:
    """
    RAW 리뷰 목록에서 평가 급변 구간을 감지합니다.

    Args:
        reviews: RAW 리뷰 목록 (timestamp_created, voted_up 필드 필요)
        existing_shift_dates: 이미 기록된 급변 시작일 집합 — 중복 방지

    Returns:
        감지된 급변 이벤트 dict 리스트 (AI 분석 필드는 비어있음)
    """
    if not reviews:
        return []

    # ── 날짜별 긍/부정 집계 ────────────────────────────────────────────────────
    daily: dict[str, dict] = defaultdict(lambda: {"pos": 0, "neg": 0})
    for r in reviews:
        ts = int(r.get("timestamp_created", 0) or 0)
        if ts <= 0:
            continue
        date_str = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
        v = r.get("voted_up", False)
        is_pos = v is True or str(v).upper() == "TRUE"
        if is_pos:
            daily[date_str]["pos"] += 1
        else:
            daily[date_str]["neg"] += 1

    if not daily:
        return []

    # ── 게임 규모 산출 → 파라미터 결정 ────────────────────────────────────────
    all_dates = sorted(daily.keys())
    start_dt  = datetime.strptime(all_dates[0],  "%Y-%m-%d")
    end_dt    = datetime.strptime(all_dates[-1], "%Y-%m-%d")

    total_revs    = sum(d["pos"] + d["neg"] for d in daily.values())
    months_elapsed = max((end_dt - start_dt).days / 30.0, 1.0)
    avg_monthly    = total_revs / months_elapsed
    min_reviews, threshold = _adaptive_params(avg_monthly)

    # ── 연속 날짜 인덱스 구성 ─────────────────────────────────────────────────
    all_days: list[str] = []
    cur = start_dt
    while cur <= end_dt:
        all_days.append(cur.strftime("%Y-%m-%d"))
        cur += timedelta(days=1)

    def _window_stats(date_list: list[str]) -> tuple[float | None, int]:
        pos   = sum(daily.get(d, {}).get("pos", 0) for d in date_list)
        neg   = sum(daily.get(d, {}).get("neg", 0) for d in date_list)
        total = pos + neg
        if total < min_reviews:
            return None, total
        return round(pos / total * 100, 1), total

    BASELINE_DAYS = 30
    WINDOW_DAYS   = 7

    # ── 슬라이딩 윈도우 감지 ──────────────────────────────────────────────────
    triggered: set[str] = set()

    for i in range(BASELINE_DAYS, len(all_days) - WINDOW_DAYS + 1):
        baseline_dates = all_days[max(0, i - BASELINE_DAYS): i]
        window_dates   = all_days[i: i + WINDOW_DAYS]

        baseline_rate, _ = _window_stats(baseline_dates)
        window_rate,   _ = _window_stats(window_dates)

        if baseline_rate is None or window_rate is None:
            continue

        if abs(window_rate - baseline_rate) >= threshold:
            for d in window_dates:
                triggered.add(d)

    if not triggered:
        return []

    # ── 인접 트리거 날짜 병합 (3일 이내 간격은 동일 구간) ─────────────────────
    sorted_triggered = sorted(triggered)
    merged: list[tuple[str, str]] = []
    seg_start = sorted_triggered[0]
    seg_end   = sorted_triggered[0]

    for d in sorted_triggered[1:]:
        d_dt    = datetime.strptime(d,       "%Y-%m-%d")
        prev_dt = datetime.strptime(seg_end, "%Y-%m-%d")
        if (d_dt - prev_dt).days <= 3:
            seg_end = d
        else:
            merged.append((seg_start, seg_end))
            seg_start = seg_end = d
    merged.append((seg_start, seg_end))

    # ── 각 구간에 대해 이벤트 dict 생성 ──────────────────────────────────────
    existing = existing_shift_dates or set()
    result: list[dict] = []

    for seg_start, seg_end in merged:
        if seg_start in existing:
            continue  # 이미 기록됨

        seg_start_dt    = datetime.strptime(seg_start, "%Y-%m-%d")
        baseline_start  = (seg_start_dt - timedelta(days=30)).strftime("%Y-%m-%d")
        baseline_end    = (seg_start_dt - timedelta(days=1)).strftime("%Y-%m-%d")

        baseline_days   = [d for d in all_days if baseline_start <= d <= baseline_end]
        seg_days        = [d for d in all_days if seg_start <= d <= seg_end]

        baseline_rate, _ = _window_stats(baseline_days)
        window_rate, window_count = _window_stats(seg_days)

        if baseline_rate is None or window_rate is None:
            continue

        delta     = round(window_rate - baseline_rate, 1)
        direction = "decline" if delta < 0 else "recovery"

        result.append({
            "event_id":              str(uuid.uuid4()),
            "event_type":            "sentiment_shift",
            "date":                  seg_start,
            "date_end":              seg_end,
            "language_scope":        "all",
            "title":                 "",
            "url":                   "",
            "sentiment_rate":        window_rate,    # after (구간 긍정율)
            "sentiment_before":      baseline_rate,  # before (30일 기준선)
            "sentiment_delta":       delta,
            "direction":             direction,
            "confidence":            _confidence(window_count),
            "review_count":          window_count,
            "ai_reaction_summary":   "",
            "top_reviews":           "[]",
            "top_keywords":          "[]",
            "linked_event_ids":      "[]",
            "is_official_confirmed": "",
        })

    return result
