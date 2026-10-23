"""
평가·리뷰량 급변 감지 (AI 없이 계산만). 결과는 analyses 표(kind='shift')에 저장하고,
왜 그랬는지에 대한 AI 해설은 나중 단계에서 채웁니다.

 - 긍정률 급변: 7일 긍정률이 직전 30일 기준선과 크게 다를 때. 게임 리뷰 규모에 따라 기준을 자동 조절.
 - 리뷰량 급증: 7일 하루 평균이 직전 30일 평균의 2배 이상일 때 (하락은 자연 감소라 제외).
 - 가까운(3일 이내) 감지일은 하나의 구간으로 합칩니다.
"""
from datetime import date, timedelta
from itertools import accumulate
import json

BASELINE_DAYS = 30
WINDOW_DAYS = 7
VOLUME_SPIKE_RATIO = 2.0
VOLUME_MIN_BASELINE = 20          # 기준선이 하루 20건 미만이면 급증 판정 안 함
VOLUME_MIN_WINDOW = 100           # 7일 합계가 이보다 적으면 무시


def _adaptive_params(avg_monthly: float) -> tuple[int, float]:
    """(구간 최소 리뷰 수, 변화폭 임계 pp)"""
    if avg_monthly >= 500:
        return 20, 10.0
    if avg_monthly >= 100:
        return 15, 15.0
    return 10, 25.0


def _confidence(n: int) -> str:
    return "high" if n >= 50 else "medium" if n >= 20 else "low"


def _merge(days: list[date], gap: int = 3) -> list[tuple[date, date]]:
    out: list[tuple[date, date]] = []
    for d in sorted(days):
        if out and (d - out[-1][1]).days <= gap:
            out[-1] = (out[-1][0], d)
        else:
            out.append((d, d))
    return out


def detect(daily: dict[date, tuple[int, int]]) -> list[dict]:
    """daily: {날짜: (긍정, 부정)} → 감지된 구간 목록 (이미 저장된 것과의 중복은 호출한 쪽에서 거름)"""
    if not daily:
        return []
    first, last = min(daily), max(daily)
    span = (last - first).days + 1
    if span < BASELINE_DAYS + WINDOW_DAYS:
        return []
    pos = [daily.get(first + timedelta(days=i), (0, 0))[0] for i in range(span)]
    neg = [daily.get(first + timedelta(days=i), (0, 0))[1] for i in range(span)]
    P = [0] + list(accumulate(pos)); N = [0] + list(accumulate(neg))     # 누적합으로 구간 합을 빠르게
    total = P[-1] + N[-1]
    min_reviews, threshold = _adaptive_params(total / max((span / 30.0), 1.0))

    def stat(a: int, b: int):  # 인덱스 a..b-1 의 (긍정률, 리뷰수)
        p, n = P[b] - P[a], N[b] - N[a]
        return (round(p / (p + n) * 100, 1) if p + n >= min_reviews else None), p + n

    trig_s, trig_v = set(), set()
    for i in range(BASELINE_DAYS, span - WINDOW_DAYS + 1):
        b_rate, _ = stat(i - BASELINE_DAYS, i)
        w_rate, w_n = stat(i, i + WINDOW_DAYS)
        if b_rate is not None and w_rate is not None and abs(w_rate - b_rate) >= threshold:
            trig_s.update(range(i, i + WINDOW_DAYS))
        b_avg = (P[i] - P[i - BASELINE_DAYS] + N[i] - N[i - BASELINE_DAYS]) / BASELINE_DAYS
        if b_avg >= VOLUME_MIN_BASELINE and w_n >= VOLUME_MIN_WINDOW and (w_n / WINDOW_DAYS) / b_avg >= VOLUME_SPIKE_RATIO:
            trig_v.update(range(i, i + WINDOW_DAYS))

    out = []
    for a, b in _merge([first + timedelta(days=i) for i in trig_s]):
        ia, ib = (a - first).days, (b - first).days
        base_rate, _ = stat(max(0, ia - BASELINE_DAYS), ia)
        win_rate, win_n = stat(ia, ib + 1)
        if base_rate is None or win_rate is None:
            continue
        delta = round(win_rate - base_rate, 1)
        out.append({"metric": "sentiment", "start": a, "end": b, "rate": win_rate, "before": base_rate, "delta": delta,
                    "direction": "decline" if delta < 0 else "recovery", "count": win_n, "confidence": _confidence(win_n)})
    for a, b in _merge([first + timedelta(days=i) for i in trig_v]):
        ia, ib = (a - first).days, (b - first).days
        b_avg = (P[ia] - P[max(0, ia - BASELINE_DAYS)] + N[ia] - N[max(0, ia - BASELINE_DAYS)]) / max(1, min(BASELINE_DAYS, ia))
        w_n = P[ib + 1] - P[ia] + N[ib + 1] - N[ia]
        w_avg = w_n / (ib - ia + 1)
        out.append({"metric": "volume", "start": a, "end": b, "baseline_per_day": round(b_avg, 1), "window_per_day": round(w_avg, 1),
                    "ratio": round(w_avg / b_avg, 2) if b_avg else None, "count": w_n, "confidence": _confidence(w_n)})
    return sorted(out, key=lambda x: x["start"])


def save_new(conn, appid: int, found: list[dict]) -> int:
    """이미 저장된 구간(±3일 겹침)은 건너뛰고 새 구간만 analyses 에 넣습니다. 새로 넣은 건수를 돌려줍니다."""
    existing = conn.execute("""select period_start, coalesce(period_end, period_start), coalesce(extra->>'metric', 'sentiment')
                               from analyses where appid = %s and kind = 'shift'""", (appid,)).fetchall()
    added = 0
    for f in found:
        if any(m == f["metric"] and f["start"] <= e + timedelta(days=3) and f["end"] >= s - timedelta(days=3) for s, e, m in existing):
            continue
        extra = {k: v for k, v in f.items() if k not in ("start", "end", "count", "rate")}
        extra.update({"sentiment_before": f.get("before"), "sentiment_delta": f.get("delta")} if f["metric"] == "sentiment" else {})
        key = f["start"].isoformat() if f["metric"] == "sentiment" else "v" + f["start"].isoformat()
        conn.execute("""insert into analyses (appid, kind, period_key, scope, period_start, period_end, title, sentiment_rate,
                          review_count, extra) values (%s,'shift',%s,'all',%s,%s,%s,%s,%s,%s::jsonb)
                        on conflict (appid, kind, period_key, scope) do nothing""",
                     (appid, key, f["start"], f["end"], "평가 급변" if f["metric"] == "sentiment" else "리뷰 급증",
                      f.get("rate"), f["count"], json.dumps(extra, ensure_ascii=False, default=str)))
        added += 1
    return added


def load_daily(conn, appid: int) -> dict[date, tuple[int, int]]:
    rows = conn.execute("select day, sum(pos), sum(neg) from review_daily where appid = %s group by day", (appid,)).fetchall()
    return {d: (int(p), int(n)) for d, p, n in rows}
