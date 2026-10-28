"""
게임별 지표 계산과 진단 배지. AI 없이 숫자 규칙만 씁니다.

진단 규칙 (평가 × 활동) — 기준은 게임마다 그 게임 자신의 기록으로 정합니다
  평가가 '나쁨'  : 최근 30일 긍정률이 70% 미만이거나, Steam 누적 긍정률보다 '그 게임의 평소 흔들림 폭'과 5%p 중 큰 쪽 이상 낮음
  활동이 '감소'  : 리뷰 속도 변화(직전 30일 대비)에서 '그 게임이 평소 한 달에 줄어들던 만큼'을 뺀 값과 동접 피크 변화의 평균이,
                   -15% 또는 '그 게임의 평소 변동 폭의 1.5배' 중 큰 쪽 이하
                   (오래된 게임은 서서히 줄어드는 게 정상이라, 평소 흐름보다 더 빠르게 줄 때만 '감소'로 봄.
                    과거 기록이 3개월 미만이면 고정 기준 -15%를 씁니다)
  건강 = 좋음+유지 / 조용한 이탈 = 좋음+감소 / 불만 = 나쁨+유지 / 침체 = 나쁨+감소
  수집 단계가 '휴면'인 게임은 활동 판정을 하지 않고 평가만 봅니다.
"""
import json
import math
from datetime import date, timedelta

from common import now_utc

MIN_REVIEWS_FOR_RATE = 30      # 이보다 적으면 긍정률을 계산하지 않음 (표본 부족)
BAD_RATE_ABS = 70.0
BAD_RATE_DROP = 5.0
ACTIVITY_DOWN = -15.0

BANDS = [("lt2", 0, 120), ("2to10", 120, 600), ("10to100", 600, 6000), ("100to300", 6000, 18000), ("gt300", 18000, 10**9)]


def _rate(pos: int, neg: int, min_n: int = MIN_REVIEWS_FOR_RATE):
    n = pos + neg
    return round(pos / n * 100, 1) if n >= min_n else None


def _pct(new, old, min_old=1.0):
    return round((new / old - 1) * 100, 1) if old is not None and old >= min_old else None


def _median(xs):
    xs = sorted(xs)
    n = len(xs)
    return None if not n else xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2


def _sd(xs):
    if len(xs) < 2:
        return 0.0
    mu = sum(xs) / len(xs)
    return (sum((x - mu) ** 2 for x in xs) / (len(xs) - 1)) ** 0.5


def own_history(days: dict, today: date) -> dict:
    """그 게임 자신의 과거 30일 단위 기록으로 '평소 흐름'을 구한다.
    - velocity_drift: 한 달 사이 리뷰 수가 평소 몇 % 바뀌었는지(중앙값). 오래된 게임은 보통 마이너스.
    - velocity_noise: 그 변화가 달마다 흔들리는 폭(로그 단위, 최소 0.12)
    - rate_noise: 달마다 긍정률이 흔들리는 폭(%p, 표본 크기만으로 생기는 흔들림보다 작게 잡지 않음)
    최근 30일 창(k=0)은 빼고 그 이전 최대 6개 창만 씁니다. 리뷰 30건 미만인 창은 건너뜁니다."""
    def win(k):
        pos = neg = 0
        for i in range(1 + 30 * k, 31 + 30 * k):
            p, n = days.get(today - timedelta(days=i), (0, 0))
            pos += p; neg += n
        return pos, neg
    ws = [win(k) for k in range(1, 8)]                       # k=1..7: 직전 30일, 그 전 30일, ...
    counts = [p + n for p, n in ws]
    # 달마다 리뷰 수가 크게 들쭉날쭉(세일·업데이트)해서, 비율의 로그값으로 보고 이상치에 덜 흔들리는 방식(중앙값·MAD)으로 평소 흐름과 흔들림을 구한다
    changes = [math.log(counts[i] / counts[i + 1]) for i in range(len(counts) - 1) if counts[i] >= 30 and counts[i + 1] >= 30]
    rates = [(p / (p + n) * 100, p + n) for p, n in ws if p + n >= 30]
    out = {"velocity_drift": None, "velocity_noise": None, "rate_noise": None, "history_windows": len(changes)}
    if len(changes) >= 3:
        med = _median(changes)
        mad = _median([abs(x - med) for x in changes]) * 1.4826
        out["velocity_drift"] = round((math.exp(med) - 1) * 100, 1)             # 평소 한 달에 몇 % 바뀌는지
        out["velocity_noise"] = round(max(mad, 0.12), 3)                         # 로그 단위 흔들림 (0.12 ≈ ±13%)
    if len(rates) >= 3:
        binom = sum(((r / 100) * (1 - r / 100) / n) ** 0.5 * 100 for r, n in rates) / len(rates)
        out["rate_noise"] = round(max(_sd([r for r, _ in rates]), binom), 1)
    return out


def review_windows(conn, appid: int, today: date) -> dict:
    rows = conn.execute("""select day, sum(pos), sum(neg) from review_daily
                           where appid = %s and day >= %s group by day""", (appid, today - timedelta(days=250))).fetchall()
    days = {d: (int(p), int(n)) for d, p, n in rows}

    def win(a, b):  # 오늘 기준 a일 전 ~ b-1일 전 (오늘은 아직 덜 모였으니 제외)
        pos = neg = 0
        for i in range(a, b):
            p, n = days.get(today - timedelta(days=i), (0, 0))
            pos += p; neg += n
        return pos, neg

    p1, n1 = win(1, 31)
    p0, n0 = win(31, 61)
    pos30, window = _rate(p1, n1), 30
    if pos30 is None:                      # 리뷰가 적은 게임은 최근 90일로 넓혀서 긍정률을 봅니다
        p9, n9 = win(1, 91)
        pos30, window = _rate(p9, n9), 90
    out = {"pos30": pos30, "pos_window_days": window, "n30": p1 + n1, "pos_prev30": _rate(p0, n0), "n_prev30": p0 + n0,
           "velocity": round((p1 + n1) / 30, 1), "velocity_prev": round((p0 + n0) / 30, 1),
           "velocity_change": _pct((p1 + n1) / 30, (p0 + n0) / 30)}
    out.update(own_history(days, today))
    return out


def ccu_stats(conn, appid: int) -> dict:
    now = now_utc()
    rows = conn.execute("""select (sampled_at at time zone 'UTC')::date d, max(ccu), count(*) from ccu_samples
                           where appid = %s and sampled_at >= %s group by 1 order by 1""",
                        (appid, now - timedelta(days=40))).fetchall()
    today = now.date()
    peaks = {d: m for d, m, _ in rows if d < today}          # 하루가 끝난 날만
    recent = [peaks[d] for d in peaks if (today - d).days <= 7]
    base = [peaks[d] for d in peaks if 7 < (today - d).days <= 35]
    last = conn.execute("select sampled_at, ccu from ccu_samples where appid = %s order by sampled_at desc limit 1", (appid,)).fetchone()
    allpeak = conn.execute("select max(ccu) from ccu_samples where appid = %s", (appid,)).fetchone()[0]
    out = {"ccu_now": last[1] if last else None, "ccu_now_at": last[0].isoformat() if last else None, "ccu_peak_all": allpeak,
           "ccu_peak7": max(recent) if len(recent) >= 4 else None,
           "ccu_base": round(sum(base) / len(base)) if len(base) >= 7 else None}
    out["ccu_change"] = _pct(out["ccu_peak7"], out["ccu_base"], 10) if out["ccu_peak7"] is not None and out["ccu_base"] else None
    out["ccu_pct_of_peak"] = round(out["ccu_now"] / allpeak * 100, 1) if out["ccu_now"] is not None and allpeak else None
    return out


def active_reviewers(conn, appid: int) -> dict:
    """긍정 리뷰 작성자 중, 리뷰를 읽어 온 시점 기준 30일 안에 접속한 비율 (마지막 접속은 수집 때 처음 알 수 있음)"""
    case = " ".join(f"when playtime_forever < {hi} then '{k}'" for k, lo, hi in BANDS)
    rows = conn.execute(f"""
        select case {case} end band, count(*) n,
               count(*) filter (where last_played >= observed_at - interval '30 days') active
        from reviews where appid = %s and voted_up and last_played is not null and observed_at is not null
              and playtime_forever is not null group by 1""", (appid,)).fetchall()
    bands = {b: {"n": int(n), "active": int(a)} for b, n, a in rows if b}
    n = sum(v["n"] for v in bands.values()); a = sum(v["active"] for v in bands.values())
    return {"active_share": round(a / n * 100, 1) if n >= 100 else None, "active_n": n, "active_bands": bands}


def diagnose(tier: str, m: dict) -> tuple[str | None, list[str]]:
    reasons = []
    pos30, pos_all = m.get("pos30"), m.get("steam_positive_rate")
    if pos30 is None:
        return None, ["최근 90일 리뷰가 적어 긍정률을 판단하지 못했습니다."]
    # 평가: 누적보다 얼마나 낮아야 '떨어졌다'고 볼지는 그 게임이 평소 흔들리던 폭에 맞춘다 (흔들림이 큰 게임은 더 많이 떨어져야)
    drop_need = max(BAD_RATE_DROP, 2.0 * (m.get("rate_noise") or 0))
    low = pos30 < BAD_RATE_ABS or (pos_all is not None and pos30 <= float(pos_all) - drop_need)
    if low:
        reasons.append(f"최근 {m.get('pos_window_days', 30)}일 긍정률 {pos30}%" + (f" (누적 {float(pos_all):.0f}%보다 낮음)" if pos_all is not None else ""))
    # 활동: 리뷰 속도는 '이 게임이 평소 줄어들던 만큼'을 뺀 값으로 본다
    vc, drift, noise = m.get("velocity_change"), m.get("velocity_drift"), m.get("velocity_noise")
    own = vc is not None and drift is not None and noise is not None and vc > -100
    # 평소 흐름 대비: (이번 변화) ÷ (평소 변화) 를 % 로. 예) 평소 -40%씩 줄던 게임이 -40% 줄었으면 0%(평소대로)
    vel = round((math.exp(math.log(1 + vc / 100) - math.log(1 + drift / 100)) - 1) * 100, 1) if own else vc
    need = max(-ACTIVITY_DOWN, (1 - math.exp(-1.5 * noise)) * 100) if own else -ACTIVITY_DOWN
    changes = [c for c in (vel, m.get("ccu_change")) if c is not None]
    down = None
    if tier != "idle" and changes:
        avg = sum(changes) / len(changes)
        down = avg <= -need
        if own:
            reasons.append(f"리뷰 속도는 직전 30일보다 {vc:+.0f}% 변했고, 이 게임은 평소 한 달에 {drift:+.0f}% 정도씩 변해 왔습니다 → 평소 흐름보다 {vel:+.0f}%"
                           f" (동접 피크 변화 {m.get('ccu_change')}, 판단 기준 -{need:.0f}%)")
        else:
            reasons.append(f"활동 변화 평균 {avg:+.0f}% (리뷰 속도 {vc}, 동접 피크 {m.get('ccu_change')}; 과거 기록이 짧아 고정 기준 -{need:.0f}% 사용)")
    if down is None:                      # 활동 자료가 없으면 평가만으로 판단
        reasons.append("활동 변화를 알 수 있는 자료가 아직 부족합니다.")
        return ("angry" if low else "healthy"), reasons
    if low and down:
        return "cool", reasons
    if low:
        return "angry", reasons
    return ("quiet" if down else "healthy"), reasons


def compute_metrics(conn, appid: int) -> dict:
    today = now_utc().date()
    g = conn.execute("""select name, tier, tier_override, steam_positive_rate, release_date, last_collected_at, review_cursor
                        from games where appid = %s""", (appid,)).fetchone()
    name, tier, override, steam_rate, release, last_collected, cursor = g
    tier = override or tier
    latest = conn.execute("select max(created_at) from reviews where appid = %s", (appid,)).fetchone()[0]
    m = {"appid": appid, "name": name, "asof": today.isoformat(), "tier": tier,
         "steam_positive_rate": float(steam_rate) if steam_rate is not None else None}
    m.update(review_windows(conn, appid, today))
    m.update(ccu_stats(conn, appid))
    m.update(active_reviewers(conn, appid))
    # 머리 쪽(최신) 리뷰가 아직 안 채워진 게임은 진단을 보류
    stale_days = (now_utc() - latest).days if latest else None
    m["data_ready"] = bool(last_collected) or (stale_days is not None and stale_days <= 3)
    diag, reasons = diagnose(tier, m) if m["data_ready"] else (None, ["최신 리뷰 수집이 아직 끝나지 않았습니다."])
    m["diagnosis"], m["diagnosis_reasons"] = diag, reasons
    ev = conn.execute("select max(event_date) from events where appid = %s and type = 'official'", (appid,)).fetchone()[0]
    m["last_update_date"] = ev.isoformat() if ev else None
    m["last_update_days"] = (today - ev).days if ev else None
    sh = conn.execute("""select period_start, sentiment_rate, extra from analyses where appid = %s and kind = 'shift'
                         order by period_start desc limit 1""", (appid,)).fetchone()
    m["last_shift"] = {"date": sh[0].isoformat(), "delta": (sh[2] or {}).get("sentiment_delta"),
                       "direction": (sh[2] or {}).get("direction")} if sh else None
    shift_recent = bool(sh and (today - sh[0]).days <= 14)
    m["attention"] = round((50 if diag in ("angry", "cool") else 30 if diag == "quiet" else 0)
                           + min(abs(m.get("velocity_change") or 0), 50) / 2 + (30 if shift_recent else 0)
                           + (10 if m["last_update_days"] is not None and m["last_update_days"] <= 7 else 0), 1)
    return m


def save_metrics(conn, appid: int, m: dict):
    conn.execute("""insert into game_metrics (appid, metrics, computed_at) values (%s, %s::jsonb, now())
                    on conflict (appid) do update set metrics = excluded.metrics, computed_at = now()""",
                 (appid, json.dumps(m, ensure_ascii=False, default=str)))
