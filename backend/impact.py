"""
업데이트 전후 영향 계산 (AI 없이 숫자만).
공식 업데이트·공지 하루 전~7일 전(전)과 다음 날~7일 뒤(후)를 비교해
리뷰 속도, 긍정률, 동접 피크, 업데이트 언급 비율을 구하고 반응 유형을 정합니다.

  역풍형: 긍정률이 5%p 이상 내려감 (다른 지표와 무관하게 먼저 판정)
  반등형: 그 밖에 리뷰 속도 +15% 이상 또는 동접 피크 +10% 이상 (긍정률이 소폭 내려가도 반등으로 봄)
  무반응형: 그 밖의 경우
"""
import json
import re
from datetime import date, timedelta

from common import now_utc
from metrics import _pct, _rate

WINDOW = 7
MENTION_DAYS = 14
MAX_EVENTS_PER_GAME = 12
LOOKBACK_DAYS = 240
STOP = {"update", "updates", "patch", "notes", "hotfix", "version", "release", "released", "event", "events",
        "announcement", "announcements", "news", "maintenance", "this", "that", "with", "from", "have", "will",
        "your", "available", "live", "season", "early", "access", "game", "week", "weekly"}
MAJOR_TITLE = re.compile(r"update|patch|season|expansion|dlc|launch|release|v\s?\d|\d+\.\d+|chapter|content|event", re.I)


def mention_tokens(title: str) -> list[str]:
    versions = re.findall(r"v?\d+(?:\.\d+)+", title, re.I)
    words = [w for w in re.findall(r"[A-Za-z][A-Za-z0-9'\-]{3,}", title) if w.lower() not in STOP]
    return list(dict.fromkeys(versions + words))[:6]


def _daily_peak(conn, appid: int, a: date, b: date) -> list[int]:
    rows = conn.execute("""select max(ccu) from ccu_samples where appid = %s
                           and sampled_at >= %s and sampled_at < %s group by (sampled_at at time zone 'UTC')::date""",
                        (appid, a, b + timedelta(days=1))).fetchall()
    return [r[0] for r in rows]


def measure(conn, appid: int, ev: date, title: str, other_event_dates: list[date]) -> dict | None:
    today = now_utc().date()
    if (today - ev).days < WINDOW + 1:
        return None                                          # 후 7일이 아직 안 지남
    def agg(a: date, b: date):
        r = conn.execute("select coalesce(sum(pos),0), coalesce(sum(neg),0) from review_daily where appid=%s and day between %s and %s",
                         (appid, a, b)).fetchone()
        return int(r[0]), int(r[1])
    pb, nb = agg(ev - timedelta(days=WINDOW), ev - timedelta(days=1))
    pa, na = agg(ev + timedelta(days=1), ev + timedelta(days=WINDOW))
    vb, va = (pb + nb) / WINDOW, (pa + na) / WINDOW
    rb, ra = _rate(pb, nb, 15), _rate(pa, na, 15)
    pos_delta = round(ra - rb, 1) if ra is not None and rb is not None else None
    vel_change = _pct(va, vb, 1.0)
    cb = _daily_peak(conn, appid, ev - timedelta(days=WINDOW), ev - timedelta(days=1))
    ca = _daily_peak(conn, appid, ev + timedelta(days=1), ev + timedelta(days=WINDOW))
    ccu_b, ccu_a = (max(cb) if len(cb) >= 4 else None), (max(ca) if len(ca) >= 4 else None)
    ccu_change = _pct(ccu_a, ccu_b, 10) if ccu_a is not None and ccu_b is not None else None

    tokens = mention_tokens(title)
    mention = None
    if tokens:
        end = min(ev + timedelta(days=MENTION_DAYS), today)
        pat = "|".join(re.escape(t) for t in tokens)
        total, hit = conn.execute("""select count(*), count(*) filter (where review ~* %s) from reviews
                                     where appid = %s and created_at >= %s and created_at < %s""",
                                  (pat, appid, ev + timedelta(days=1), end + timedelta(days=1))).fetchone()
        mention = {"tokens": tokens, "total": int(total), "hit": int(hit),
                   "rate": round(hit / total * 100, 2) if total else None}

    if pos_delta is not None and pos_delta <= -5:
        kind = "backfire"
    elif (vel_change is not None and vel_change >= 15) or (ccu_change is not None and ccu_change >= 10):
        kind = "rebound"
    else:
        kind = "flat"
    overlap = sum(1 for d in other_event_dates if d != ev and abs((d - ev).days) <= WINDOW)
    enough = (pb + nb) >= 30 and (pa + na) >= 30
    return {"impact": kind if enough else "unknown", "enough_data": enough, "overlapping_events": overlap,
            "velocity_before": round(vb, 1), "velocity_after": round(va, 1), "velocity_change": vel_change,
            "pos_before": rb, "pos_after": ra, "pos_delta": pos_delta,
            "ccu_peak_before": ccu_b, "ccu_peak_after": ccu_a, "ccu_change": ccu_change, "mention": mention,
            "fingerprint": f"v2|{pb + nb}:{pa + na}:{len(cb)}:{len(ca)}"}


def pick_events(conn, appid: int) -> list[tuple]:
    """영향 분석할 만한 큰 공식 이벤트만 고릅니다 (본문이 길거나 업데이트·패치성 제목)."""
    today = now_utc().date()
    rows = conn.execute("""select event_key, event_date, title, length(coalesce(content, '')) from events
                           where appid = %s and type in ('official', 'manual') and event_date >= %s and event_date <= %s
                           order by event_date desc""", (appid, today - timedelta(days=LOOKBACK_DAYS), today - timedelta(days=WINDOW + 1))).fetchall()
    major = [r for r in rows if r[3] >= 1200 or MAJOR_TITLE.search(r[2] or "")]
    best: dict = {}
    for r in major:                                   # 같은 날 공지가 여러 개면 본문이 가장 긴 하나만 (같은 수치를 반복 분석하지 않도록)
        if r[1] not in best or r[3] > best[r[1]][3]:
            best[r[1]] = r
    return sorted(best.values(), key=lambda r: r[1], reverse=True)[:MAX_EVENTS_PER_GAME]


def run_game(conn, appid: int) -> dict:
    events = pick_events(conn, appid)
    all_dates = [r[0] for r in conn.execute("select event_date from events where appid=%s and type in ('official','manual')", (appid,)).fetchall()]
    done = {r[0]: r[1] for r in conn.execute("""select period_key, input_fingerprint from analyses
                                                where appid=%s and kind='event_impact' and scope='all'""", (appid,)).fetchall()}
    saved = skipped = 0
    keep = [e[0] for e in events]                      # 이번 선정에서 빠진 예전 영향 분석(같은 날 중복 등)은 정리
    conn.execute("delete from analyses where appid = %s and kind = 'event_impact' and not (period_key = any(%s))", (appid, keep))
    for key, ev_date, title, _ in events:
        res = measure(conn, appid, ev_date, title or "", all_dates)
        if res is None:
            continue
        if done.get(key) == res["fingerprint"]:
            skipped += 1
            continue
        conn.execute("""insert into analyses (appid, kind, period_key, scope, period_start, period_end, title,
                          sentiment_rate, review_count, extra, input_fingerprint)
                        values (%s,'event_impact',%s,'all',%s,%s,%s,%s,%s,%s::jsonb,%s)
                        on conflict (appid, kind, period_key, scope) do update set
                          reaction_summary = case when analyses.extra->>'impact' is distinct from excluded.extra->>'impact'
                                                  then null else analyses.reaction_summary end,
                          extra = excluded.extra, sentiment_rate = excluded.sentiment_rate, review_count = excluded.review_count,
                          input_fingerprint = excluded.input_fingerprint, updated_at = now()""",
                     (appid, key, ev_date, ev_date + timedelta(days=WINDOW), title, res["pos_after"],
                      None, json.dumps(res, ensure_ascii=False), res["fingerprint"]))
        saved += 1
    return {"candidates": len(events), "saved": saved, "unchanged": skipped}
