"""
브리핑 생성 (AI 호출 없음): 이미 계산된 지표·분석·게임 리포트를 모아 '특이사항이 있는 게임만' 보여 줍니다.
  w4:<월요일>  최근 4주 브리핑 (매주 월요일 갱신)
  m:<YYYY-MM> 월간 정식 리포트 (매월 1일 확정)
전체 총평 문장은 만들지 않습니다. 등록되지 않은 게임의 일을 모르면서 단정하게 되기 때문입니다.
"""
import json
import re
from datetime import timedelta

from ai_tasks import add_month, month_bounds
from common import now_utc

DIAG_LABEL = {"healthy": ("good", "건강"), "quiet": ("warn", "조용한 이탈"), "angry": ("bad", "불만"), "cool": ("cool", "침체")}
IMPACT_LABEL = {"rebound": ("good", "반등형"), "backfire": ("bad", "역풍형"), "flat": ("cool", "무반응형")}


def _first_sentence(t: str, limit: int = 140) -> str:
    t = (t or "").strip()
    m = re.search(r"^(.+?[.다요])(\s|$)", t)
    return (m.group(1) if m else t)[:limit]


def _report_line(conn, appid: int) -> str | None:
    r = conn.execute("select body from game_reports where appid = %s and kind = 'report'", (appid,)).fetchone()
    try:
        return (json.loads(r[0]).get("one_liner") or None) if r and r[0] else None
    except ValueError:
        return None


def build_w4(conn, today=None) -> dict:
    today = today or now_utc().date()
    monday = today - timedelta(days=today.weekday())
    prev = conn.execute("select body from briefs where period = %s", (f"w4:{monday - timedelta(days=7)}",)).fetchone()
    prev_tags = {i["appid"]: {t[1] for t in i["tags"]} for i in (prev[0]["items"] if prev else [])}
    games = conn.execute("""select g.appid, g.name, g.thumbnail, m.metrics from games g join game_metrics m on m.appid = g.appid
                            where g.status = 'active'""").fetchall()
    items = []
    since = today - timedelta(days=28)
    for appid, name, thumb, m in games:
        if not m.get("data_ready"):
            continue
        tags, notable = [], False
        diag = m.get("diagnosis")
        if diag and diag != "healthy":
            tags.append(list(DIAG_LABEL[diag])); notable = True
        for ps, x in conn.execute("""select period_start, extra from analyses where appid=%s and kind='shift' and period_start >= %s
                                     order by period_start desc limit 2""", (appid, since)).fetchall():
            x = x or {}
            if x.get("metric", "sentiment") == "sentiment" and x.get("sentiment_delta") is not None:
                d = float(x["sentiment_delta"]); tags.append(["bad" if d < 0 else "good", f"급변 {d:+.0f}%p"]); notable = True
            elif x.get("metric") == "volume":
                tags.append(["plain", f"리뷰 급증 x{x.get('ratio')}"]); notable = True
        for ev_date, title, x in conn.execute("""select period_start, title, extra from analyses where appid=%s and kind='event_impact'
                                                 and period_start >= %s order by period_start desc limit 2""", (appid, since)).fetchall():
            kind = (x or {}).get("impact")
            if kind in IMPACT_LABEL:
                tags.append(list(IMPACT_LABEL[kind]))
                notable = notable or kind in ("rebound", "backfire")
        if not notable:
            continue
        seen = {tuple(t) for t in tags}
        tags = [list(t) for t in dict.fromkeys(tuple(t) for t in tags)][:4]
        nw = bool(prev) and (appid not in prev_tags or {t[1] for t in tags} != prev_tags[appid])
        text = _report_line(conn, appid) or "; ".join(m.get("diagnosis_reasons") or [])[:140]
        items.append({"appid": appid, "name": name, "thumbnail": thumb, "text": text, "tags": tags, "nw": nw,
                      "attention": m.get("attention") or 0})
    items.sort(key=lambda i: -i["attention"])
    body = {"asof": str(today), "period_start": str(today - timedelta(days=27)), "period_end": str(today),
            "tracked": len(games), "items": items}
    conn.execute("""insert into briefs (period, body, generated_at) values (%s, %s::jsonb, now())
                    on conflict (period) do update set body = excluded.body, generated_at = now()""",
                 (f"w4:{monday}", json.dumps(body, ensure_ascii=False)))
    return body


def build_month(conn, ym: str | None = None) -> dict:
    today = now_utc().date()
    ym = ym or add_month(today.strftime("%Y-%m"), -1)
    start, end = month_bounds(ym)
    prev = add_month(ym, -1)
    items = []
    games = conn.execute("select appid, name, thumbnail from games where status = 'active'").fetchall()
    for appid, name, thumb in games:
        rows = {r[0]: r for r in conn.execute("""select period_key, sentiment_rate, review_count, reaction_summary from analyses
                                                 where appid=%s and kind='monthly' and scope='all' and period_key in (%s,%s) and not is_sparse""",
                                              (appid, ym, prev)).fetchall()}
        cur = rows.get(ym)
        if not cur:
            continue
        tags, notable = [], False
        old = rows.get(prev)
        if old and cur[1] is not None and old[1] is not None:
            d = float(cur[1]) - float(old[1])
            if abs(d) >= 5:
                tags.append(["good" if d > 0 else "bad", f"긍정률 {d:+.0f}%p"]); notable = True
        if old and old[2] and cur[2]:
            c = (cur[2] / old[2] - 1) * 100
            if abs(c) >= 30:
                tags.append(["plain", f"리뷰 {c:+.0f}%"]); notable = True
        for (kind,) in conn.execute("""select extra->>'impact' from analyses where appid=%s and kind='event_impact'
                                       and period_start >= %s and period_start < %s""", (appid, start.date(), end.date())).fetchall():
            if kind in ("rebound", "backfire"):
                tags.append(list(IMPACT_LABEL[kind])); notable = True
        shifts = conn.execute("select count(*) from analyses where appid=%s and kind='shift' and period_start >= %s and period_start < %s",
                              (appid, start.date(), end.date())).fetchone()[0]
        if shifts:
            tags.append(["plain", f"급변 {shifts}건"]); notable = True
        if notable:
            items.append({"appid": appid, "name": name, "thumbnail": thumb, "text": _first_sentence(cur[3] or ""),
                          "tags": [list(t) for t in dict.fromkeys(tuple(t) for t in tags)][:4], "nw": False,
                          "attention": len(tags)})
    items.sort(key=lambda i: -i["attention"])
    body = {"month": ym, "tracked": len(games), "items": items}
    conn.execute("""insert into briefs (period, body, generated_at) values (%s, %s::jsonb, now())
                    on conflict (period) do update set body = excluded.body, generated_at = now()""",
                 (f"m:{ym}", json.dumps(body, ensure_ascii=False)))
    return body
