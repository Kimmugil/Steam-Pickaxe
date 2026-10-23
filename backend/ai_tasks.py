"""
AI 분석 작업: 표본 추출 · 프롬프트 · 저장 · 할 일 계획

작업 종류
  monthly        월×언어(전체 + 한국어 + 상위 3개 언어)별 반응 분석
  shift_explain  평가 급변·리뷰 급증 구간 해설
  impact_explain 업데이트 전후 영향 해설
  report         게임 리포트 (한눈 요약 3줄, 한 줄 요약, 추이, 언어권, 접속 시간대, 수명 주기)

"해야 할 일"은 저장된 결과와 현재 데이터를 비교해서 매번 계산합니다. 그래서 중간에 멈춰도
다음 실행이 빠진 것만 알아서 이어서 처리합니다.
"""
import json
import re
from datetime import date, datetime, timedelta

import gemini
from common import UTC, now_utc
from metrics import _rate

SAMPLE_ALL = 200
SAMPLE_LANG = 120
LANG_MIN = 30             # 언어별 구간 리뷰가 이보다 적으면 AI 호출을 생략
ALL_SPARSE_MAX = 5        # 전체 구간 리뷰가 이 건수 이하면 '표본 부족'으로 기록만
TOP_LANG_EXTRA = 3        # 한국어 외에 AI 해설을 붙일 상위 언어 수
MAX_ATTEMPTS = 3

LANGUAGE_NAMES = {"koreana": "한국어", "english": "영어", "schinese": "중국어(간체)", "tchinese": "중국어(번체)",
                  "japanese": "일본어", "russian": "러시아어", "french": "프랑스어", "german": "독일어",
                  "spanish": "스페인어", "latam": "스페인어(중남미)", "brazilian": "포르투갈어(브라질)",
                  "portuguese": "포르투갈어", "turkish": "터키어", "polish": "폴란드어", "thai": "태국어",
                  "vietnamese": "베트남어", "italian": "이탈리아어", "ukrainian": "우크라이나어"}


def lang_name(code: str) -> str:
    return "전체" if code == "all" else LANGUAGE_NAMES.get(code, code)


def month_bounds(ym: str) -> tuple[datetime, datetime]:
    y, m = int(ym[:4]), int(ym[5:7])
    start = datetime(y, m, 1, tzinfo=UTC)
    end = datetime(y + (m == 12), (m % 12) + 1, 1, tzinfo=UTC)
    return start, end


def add_month(ym: str, k: int = 1) -> str:
    y, m = int(ym[:4]), int(ym[5:7]) - 1 + k
    return f"{y + m // 12:04d}-{m % 12 + 1:02d}"


# ───────────────────────── 표본 추출 ─────────────────────────
def sample_reviews(conn, appid: int, start, end, scope: str = "all", n: int = SAMPLE_ALL, pattern: str | None = None):
    """긍정/부정 비율을 지키면서 '도움이 된 리뷰 40% + 최신 20% + 무작위 40%'로 뽑습니다. (추천 수만 보면 쏠리기 때문)"""
    cond = "appid = %s and created_at >= %s and created_at < %s and length(coalesce(review, '')) >= 10"
    params: list = [appid, start, end]
    if scope != "all":
        cond += " and language = %s"; params.append(scope)
    if pattern:
        cond += " and review ~* %s"; params.append(pattern)
    pos_n, neg_n = conn.execute(f"select count(*) filter (where voted_up), count(*) filter (where not voted_up) from reviews where {cond}", params).fetchone()
    pos_n, neg_n = int(pos_n), int(neg_n)
    total = pos_n + neg_n
    rows: dict = {}
    if total == 0:
        return [], 0, 0
    for up, side_n in ((True, pos_n), (False, neg_n)):
        if side_n == 0:
            continue
        quota = min(side_n, max(round(n * side_n / total), min(side_n, 12)))
        for order, share in (("votes_up desc, created_at desc", 0.4), ("created_at desc", 0.2), ("random()", 0.4)):
            lim = max(1, round(quota * share))
            for r in conn.execute(f"""select recommendationid, voted_up, language, left(review, 420), created_at, votes_up,
                                             coalesce(playtime_at_review, playtime_forever) from reviews
                                      where {cond} and voted_up = %s order by {order} limit %s""", params + [up, lim]):
                rows.setdefault(r[0], {"id": r[0], "up": r[1], "lang": r[2], "text": r[3].replace("\n", " "), "at": r[4], "votes": r[5], "pt": r[6]})
    return list(rows.values()), pos_n, neg_n


def review_lines(rows: list[dict]) -> str:
    out = []
    for r in rows:
        hrs = f"{round(r['pt'] / 60)}시간" if r["pt"] else "?"
        out.append(f"#{r['id']} [{'긍정' if r['up'] else '부정'}][{r['lang']}][{hrs}] {r['text']}")
    return "\n".join(out)


def resolve_top_reviews(conn, appid: int, picked, sample_ids: set[int]) -> list[dict]:
    """AI가 고른 리뷰 번호의 '원문'은 DB에서 직접 가져옵니다. (AI가 원문을 바꾸거나 지어내지 못하게)"""
    out = []
    for p in (picked or [])[:3]:
        try:
            rid = int(p.get("id"))
        except (TypeError, ValueError, AttributeError):
            continue
        if rid not in sample_ids:
            continue
        r = conn.execute("select review, voted_up, language from reviews where appid = %s and recommendationid = %s", (appid, rid)).fetchone()
        if r:
            out.append({"id": rid, "text": (r[0] or "")[:700], "text_kr": str(p.get("text_kr") or "")[:700], "voted_up": r[1], "language": r[2]})
    return out


def events_context(conn, appid: int, start: date, end: date, limit: int = 6) -> str:
    rows = conn.execute("""select event_date, title, coalesce(ai_summary, left(content, 350), '') from events
                           where appid = %s and type in ('official', 'manual') and event_date between %s and %s
                           order by length(coalesce(content, '')) desc limit %s""", (appid, start, end, limit)).fetchall()
    rows.sort(key=lambda r: r[0])
    return "\n".join(f"- [{d}] {t}: {str(s)[:300]}" for d, t, s in rows) or "(해당 기간 공식 공지 없음)"


def _clean_kw(kw) -> list[str]:
    return [str(k)[:60] for k in (kw or [])][:5] if isinstance(kw, list) else []


def save_analysis(conn, appid, kind, period_key, scope, *, start=None, end=None, title=None, rate=None, count=None,
                  sparse=False, summary=None, keywords=None, top_reviews=None, extra=None, fingerprint=None):
    conn.execute("""insert into analyses (appid, kind, period_key, scope, period_start, period_end, title, sentiment_rate, review_count,
                      is_sparse, reaction_summary, keywords, top_reviews, extra, input_fingerprint, model)
                    values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s::jsonb,%s,%s)
                    on conflict (appid, kind, period_key, scope) do update set
                      period_start = excluded.period_start, period_end = excluded.period_end, title = excluded.title,
                      sentiment_rate = excluded.sentiment_rate, review_count = excluded.review_count, is_sparse = excluded.is_sparse,
                      reaction_summary = excluded.reaction_summary, keywords = excluded.keywords, top_reviews = excluded.top_reviews,
                      extra = analyses.extra || excluded.extra, input_fingerprint = coalesce(excluded.input_fingerprint, analyses.input_fingerprint),
                      model = excluded.model, updated_at = now()""",
                 (appid, kind, period_key, scope, start, end, title, rate, count, sparse, summary,
                  json.dumps(keywords or [], ensure_ascii=False), json.dumps(top_reviews or [], ensure_ascii=False),
                  json.dumps(extra or {}, ensure_ascii=False, default=str), fingerprint, gemini.MODEL if not sparse else None))


# ───────────────────────── 실행: 월간 ─────────────────────────
def month_counts(conn, appid: int, ym: str, scope: str) -> tuple[int, int]:
    s, e = month_bounds(ym)
    q = "select coalesce(sum(pos), 0), coalesce(sum(neg), 0) from review_daily where appid = %s and day >= %s and day < %s"
    p: list = [appid, s.date(), e.date()]
    if scope != "all":
        q += " and language = %s"; p.append(scope)
    pos, neg = conn.execute(q, p).fetchone()
    return int(pos), int(neg)


def run_monthly(conn, g: dict, ym: str, scope: str):
    appid, name = g["appid"], g["name"]
    start, end = month_bounds(ym)
    end = min(end, now_utc())
    pos, neg = month_counts(conn, appid, ym, scope)
    n = pos + neg
    title = f"{ym[:4]}년 {ym[5:7]}월"
    ps, pe = start.date(), month_bounds(ym)[1].date() - timedelta(days=1)
    if scope == "all" and n <= ALL_SPARSE_MAX:
        save_analysis(conn, appid, "monthly", ym, scope, start=ps, end=pe, title=title, count=n, sparse=True, fingerprint=str(n))
        return {"sparse": True}
    sample, _, _ = sample_reviews(conn, appid, start, end, scope, SAMPLE_ALL if scope == "all" else SAMPLE_LANG)
    prev_pos, prev_neg = month_counts(conn, appid, add_month(ym, -1), scope)
    prev = _rate(prev_pos, prev_neg, 20)
    all_pos, all_neg = month_counts(conn, appid, ym, "all")
    rate = round(pos / n * 100, 1) if n else None
    events = events_context(conn, appid, ps, pe)
    if scope == "all":
        shape = '''{"reaction_summary": "긍정과 부정 포인트를 나눠 서술하고, 원인이 분명하면 구체적으로(버그, 기능, 이벤트, 가격 등) 언급. 2~4문장",
 "keywords": ["핵심 키워드 최대 5개"],
 "update_summary": "공식 공지가 있으면 핵심 변경 내용을 2~3문장으로, 없으면 빈 문자열",
 "top_reviews": [{"id": 리뷰 번호(숫자), "text_kr": "그 리뷰의 한국어 번역 (한국어 원문이면 그대로)"}]}
top_reviews는 긍정 1~2건 + 부정 1건을 고릅니다. 표본에 있는 번호만 사용하세요.'''
        focus = "이 달 유저 반응 전반"
    else:
        shape = '''{"reaction_summary": "이 언어권 유저에게서 두드러진 칭찬과 불만. 전체 평균과 다른 점이 있으면 함께 언급. 2~3문장",
 "keywords": ["핵심 키워드 최대 5개"], "update_summary": "", "top_reviews": []}'''
        focus = f"{lang_name(scope)} 사용자만의 반응 (전체 긍정률은 {_rate(all_pos, all_neg, 1)}%)"
    prompt = f"""게임: {name}
구간: {title} / 분석 범위: {lang_name(scope)}
이 구간 {lang_name(scope)} 리뷰 {n:,}건 중 긍정 {rate}% (직전 달 {prev if prev is not None else '자료 없음'}%)
관심 주제: {focus}
이 달의 공식 공지:
{events}

아래는 리뷰 표본 {len(sample)}건이다. 줄 형식은 '#번호 [긍정/부정][언어][작성 시점 플레이타임] 본문'이다.
{review_lines(sample)}

아래 JSON 형식으로만 답하세요.
{shape}"""
    out = gemini.generate_json(conn, prompt)
    top = resolve_top_reviews(conn, appid, out.get("top_reviews"), {r["id"] for r in sample}) if scope == "all" else []
    save_analysis(conn, appid, "monthly", ym, scope, start=ps, end=pe, title=title, rate=rate, count=n,
                  summary=str(out.get("reaction_summary") or "")[:1500], keywords=_clean_kw(out.get("keywords")), top_reviews=top,
                  extra={"update_summary": str(out.get("update_summary") or "")[:1200]} if scope == "all" else {}, fingerprint=str(n))
    return {"n": n, "sample": len(sample)}


# ───────────────────────── 실행: 급변·영향 해설 ─────────────────────────
def run_shift_explain(conn, g: dict, period_key: str):
    appid, name = g["appid"], g["name"]
    row = conn.execute("select period_start, period_end, review_count, sentiment_rate, extra from analyses where appid=%s and kind='shift' and period_key=%s and scope='all'",
                       (appid, period_key)).fetchone()
    ps, pe, cnt, rate, extra = row
    pe = pe or ps
    metric = (extra or {}).get("metric", "sentiment")
    s_dt = datetime(ps.year, ps.month, ps.day, tzinfo=UTC)
    e_dt = datetime(pe.year, pe.month, pe.day, tzinfo=UTC) + timedelta(days=1)
    win, _, _ = sample_reviews(conn, appid, s_dt, e_dt, "all", 80)
    base, _, _ = sample_reviews(conn, appid, s_dt - timedelta(days=30), s_dt, "all", 30)
    events = events_context(conn, appid, ps - timedelta(days=10), pe + timedelta(days=3))
    if metric == "sentiment":
        fact = (f"긍정률이 직전 30일 평균 {extra.get('sentiment_before')}%에서 이 구간 {rate}%로 {extra.get('sentiment_delta')}%p 바뀌었다. "
                f"(구간 리뷰 {cnt:,}건)")
    else:
        fact = (f"하루 평균 리뷰가 직전 30일 {extra.get('baseline_per_day')}건에서 이 구간 {extra.get('window_per_day')}건으로 "
                f"{extra.get('ratio')}배가 되었다. (구간 리뷰 {cnt:,}건)")
    prompt = f"""게임: {name}
구간: {ps} ~ {pe}
감지된 변화: {fact}
이 시기 전후의 공식 공지:
{events}

[구간 안 리뷰 표본 {len(win)}건]
{review_lines(win)}

[비교용: 직전 30일 리뷰 표본 {len(base)}건]
{review_lines(base)}

구간 안 표본과 비교용 표본의 차이에 주목해 아래 JSON으로만 답하세요.
{{"reaction_summary": "무엇이 달라졌고 유저가 무엇을 말하는지. 가능한 원인은 단정하지 않고 가능성으로. 2~4문장",
 "keywords": ["핵심 키워드 최대 5개"],
 "linked_event_titles": ["원인과 관련 있어 보이는 공지 제목(위 목록에 있는 것만)"],
 "top_reviews": [{{"id": 리뷰 번호, "text_kr": "한국어 번역"}}]}}
top_reviews는 구간 안 표본에서 변화를 가장 잘 보여 주는 리뷰 2~3건."""
    out = gemini.generate_json(conn, prompt)
    top = resolve_top_reviews(conn, appid, out.get("top_reviews"), {r["id"] for r in win})
    save_analysis(conn, appid, "shift", period_key, "all", start=ps, end=pe, title=None, rate=rate, count=cnt,
                  summary=str(out.get("reaction_summary") or "")[:1500], keywords=_clean_kw(out.get("keywords")), top_reviews=top,
                  extra={"linked_event_titles": [str(t)[:120] for t in (out.get("linked_event_titles") or [])][:3]},
                  fingerprint=str(cnt))
    return {"sample": len(win)}


def run_impact_explain(conn, g: dict, event_key: str):
    appid, name = g["appid"], g["name"]
    row = conn.execute("select period_start, title, extra from analyses where appid=%s and kind='event_impact' and period_key=%s and scope='all'",
                       (appid, event_key)).fetchone()
    ev_date, title, x = row
    content = conn.execute("select coalesce(content, '') from events where appid=%s and event_key=%s", (appid, event_key)).fetchone()[0]
    s_dt = datetime(ev_date.year, ev_date.month, ev_date.day, tzinfo=UTC) + timedelta(days=1)
    after, _, _ = sample_reviews(conn, appid, s_dt, s_dt + timedelta(days=7), "all", 40)
    mention = x.get("mention") or {}
    mentioned = []
    if mention.get("tokens"):
        pat = "|".join(re.escape(t) for t in mention["tokens"])
        mentioned, _, _ = sample_reviews(conn, appid, s_dt, s_dt + timedelta(days=14), "all", 15, pattern=pat)
    kind_ko = {"rebound": "반등형", "backfire": "역풍형", "flat": "무반응형"}.get(x.get("impact"), "판단 보류")
    prompt = f"""게임: {name}
업데이트·공지: [{ev_date}] {title}
공지 본문(일부): {content[:900] or '(본문 없음)'}

전후 7일 비교(계산된 수치):
- 리뷰 속도: {x.get('velocity_before')} → {x.get('velocity_after')} 건/일 ({x.get('velocity_change')}%)
- 긍정률: {x.get('pos_before')} → {x.get('pos_after')} (변화 {x.get('pos_delta')}%p)
- 동접 피크: {x.get('ccu_peak_before')} → {x.get('ccu_peak_after')} ({x.get('ccu_change')}%)
- 이후 14일 리뷰 {mention.get('total')}건 중 이 업데이트 관련 단어를 언급한 리뷰 {mention.get('hit')}건 ({mention.get('rate')}%, 영어 단어 기준이라 실제보다 적게 잡힐 수 있음)
- 계산상 반응 유형: {kind_ko}{' (같은 주에 다른 공지가 겹침)' if x.get('overlapping_events') else ''}

[이 업데이트를 언급한 리뷰 {len(mentioned)}건]
{review_lines(mentioned) or '(없음)'}

[이후 7일 리뷰 표본 {len(after)}건]
{review_lines(after)}

아래 JSON으로만 답하세요. 수치는 위 계산값만 사용합니다.
{{"reaction_summary": "이 업데이트가 유저에게 닿았는지, 어떤 반응이 나왔는지 2~3문장. 변화가 작으면 '뚜렷한 반응이 없었다'고 솔직하게"}}"""
    out = gemini.generate_json(conn, prompt)
    save_analysis(conn, appid, "event_impact", event_key, "all", start=ev_date, end=ev_date + timedelta(days=7), title=title,
                  rate=x.get("pos_after"), summary=str(out.get("reaction_summary") or "")[:1200],
                  extra={}, fingerprint=None)
    return {"sample": len(after)}


# ───────────────────────── 실행: 게임 리포트 ─────────────────────────
def kst_peak_hours(conn, appid: int):
    rows = conn.execute("""select extract(hour from sampled_at at time zone 'Asia/Seoul')::int h, avg(ccu), count(distinct (sampled_at at time zone 'UTC')::date)
                           from ccu_samples where appid = %s and sampled_at >= now() - interval '60 days' group by 1 order by 1""", (appid,)).fetchall()
    if not rows or max(r[2] for r in rows) < 4:
        return None
    top = sorted(rows, key=lambda r: -r[1])[:3]
    return [{"hour_kst": r[0], "avg_ccu": round(float(r[1]))} for r in top]


def run_report(conn, g: dict, fingerprint: str):
    appid, name = g["appid"], g["name"]
    m = conn.execute("select metrics from game_metrics where appid = %s", (appid,)).fetchone()[0]
    monthly = conn.execute("""select period_key, sentiment_rate, review_count, left(coalesce(reaction_summary, ''), 220) from analyses
                              where appid=%s and kind='monthly' and scope='all' and not is_sparse order by period_key desc limit 6""", (appid,)).fetchall()
    shifts = conn.execute("""select period_start, extra, left(coalesce(reaction_summary, ''), 180) from analyses
                             where appid=%s and kind='shift' order by period_start desc limit 3""", (appid,)).fetchall()
    impacts = conn.execute("""select period_start, title, extra, left(coalesce(reaction_summary, ''), 180) from analyses
                              where appid=%s and kind='event_impact' order by period_start desc limit 4""", (appid,)).fetchall()
    langs = conn.execute("""select language, sum(pos), sum(neg) from review_daily where appid=%s and day >= current_date - 30 and language <> ''
                            group by 1 order by sum(pos + neg) desc limit 6""", (appid,)).fetchall()
    rel = conn.execute("select release_date from games where appid=%s", (appid,)).fetchone()[0]
    first_review = conn.execute("select min(day) from review_daily where appid=%s", (appid,)).fetchone()[0]
    age = (now_utc().date() - first_review).days if first_review else None
    peak = kst_peak_hours(conn, appid)
    act = m.get("active_bands") or {}
    prompt = f"""게임: {name} (Steam 표기 출시일 {rel}, 첫 리뷰는 {first_review}에 작성됨 = 얼리 액세스 포함 실제 서비스 시작 후 {age}일)
진단 배지(규칙으로 계산): {m.get('diagnosis')} / 근거: {'; '.join(m.get('diagnosis_reasons') or [])}

[핵심 지표 — 최근 30일]
- 긍정률 {m.get('pos30')}% (직전 30일 {m.get('pos_prev30')}%, Steam 누적 {m.get('steam_positive_rate')}%)
- 하루 리뷰 {m.get('velocity')}건 (직전 대비 {m.get('velocity_change')}%)
- 동접 피크 변화 {m.get('ccu_change')}%, 현재 {m.get('ccu_now')}명 (역대 피크 대비 {m.get('ccu_pct_of_peak')}%)
- 긍정 리뷰 작성자 중 최근 30일 접속 비율 {m.get('active_share')}% (표본 {m.get('active_n')}건), 구간별 {json.dumps(act, ensure_ascii=False)}

[월간 분석 (최신순)]
{chr(10).join(f"- {k}: 긍정률 {r}%, 리뷰 {c}건. {s}" for k, r, c, s in monthly) or '(없음)'}

[최근 평가 급변·리뷰 급증]
{chr(10).join(f"- {d}: {json.dumps({k: v for k, v in (x or {}).items() if k in ('metric', 'sentiment_delta', 'ratio', 'direction')}, ensure_ascii=False)} {s}" for d, x, s in shifts) or '(없음)'}

[최근 업데이트의 전후 영향]
{chr(10).join(f"- {d} {t}: {(x or {}).get('impact')}, 리뷰 속도 {(x or {}).get('velocity_change')}%, 긍정률 변화 {(x or {}).get('pos_delta')}%p. {s}" for d, t, x, s in impacts) or '(없음)'}

[언어별 최근 30일 긍정률]
{chr(10).join(f"- {lang_name(l)}: {_rate(int(p), int(n), 20)}% (리뷰 {int(p) + int(n)}건)" for l, p, n in langs) or '(없음)'}

[동접이 높은 시간대(한국 시간)]
{json.dumps(peak, ensure_ascii=False) if peak else '(자료 부족)'}

위 자료만 근거로 아래 JSON으로만 답하세요. 자료에 없는 내용은 쓰지 않습니다. 평가는 좋은데 활동이 줄었는지 같은 '평가와 활동의 관계'를 중심으로 쓰세요.
{{"one_liner": "게임 카드에 들어갈 한 줄 요약. 60자 이내, ~다 체",
 "bullets": ["지금 상태를 보여 주는 핵심 3문장 (각각 한 문장)", "...", "..."],
 "trend": "평가 추이 진단 2~3문장",
 "language": "언어권별 차이 2~3문장 (언어별 자료가 없으면 빈 문자열)",
 "peaktime": "접속이 몰리는 시간대 해석 1~2문장 (자료 없으면 빈 문자열)",
 "lifecycle": "출시 후 흐름(초기-성장-성숙) 관점의 진단 2~3문장"}}"""
    out = gemini.generate_json(conn, prompt)
    body = {k: out.get(k) for k in ("one_liner", "bullets", "trend", "language", "peaktime", "lifecycle")}
    body["bullets"] = [str(b)[:300] for b in (body.get("bullets") or [])][:3]
    conn.execute("""insert into game_reports (appid, kind, body, generated_at, input_fingerprint) values (%s,'report',%s,now(),%s)
                    on conflict (appid, kind) do update set body = excluded.body, generated_at = now(), input_fingerprint = excluded.input_fingerprint""",
                 (appid, json.dumps(body, ensure_ascii=False), fingerprint))
    return {"bullets": len(body["bullets"])}


# ───────────────────────── 할 일 계획 ─────────────────────────
def scopes_for(g: dict) -> list[str]:
    langs = [l for l in (g.get("top_languages") or []) if l != "koreana"][:TOP_LANG_EXTRA]
    return ["all", "koreana"] + (langs or ["english"])


def plan_monthly(conn, g: dict) -> list[dict]:
    appid = g["appid"]
    today = now_utc().date()
    cur_ym, prev_ym = today.strftime("%Y-%m"), add_month(today.strftime("%Y-%m"), -1)
    first_day = conn.execute("select min(day) from review_daily where appid = %s", (appid,)).fetchone()[0]
    if not first_day:
        return []
    first = first_day.strftime("%Y-%m")
    if g.get("ai_since"):
        first = max(first, g["ai_since"].strftime("%Y-%m"))
    counts: dict = {}
    for ym, lang, n in conn.execute("""select to_char(day, 'YYYY-MM'), language, sum(pos + neg) from review_daily
                                       where appid = %s group by 1, 2""", (appid,)).fetchall():
        counts[(ym, lang)] = int(n)
        counts[(ym, "all")] = counts.get((ym, "all"), 0) + int(n)
    existing = {(r[0], r[1]): r for r in conn.execute("""select period_key, scope, input_fingerprint, is_sparse, updated_at from analyses
                                                         where appid = %s and kind = 'monthly'""", (appid,)).fetchall()}
    tasks = []
    ym = first
    while ym <= cur_ym:
        for scope in scopes_for(g):
            n = counts.get((ym, scope), 0)
            need_min = ALL_SPARSE_MAX + 1 if scope == "all" else LANG_MIN
            row = existing.get((ym, scope))
            if n < need_min:
                if scope == "all" and row is None and n > 0:
                    tasks.append({"kind": "monthly", "period_key": ym, "scope": scope, "reason": "표본 부족 기록", "prio": 90})
                continue
            reason = None
            if row is None:
                reason = "새 구간"
            elif row[3]:
                reason = "예전에 표본 부족이었으나 리뷰가 늘어남"
            elif row[2] is None:                                # 예전 시스템이 만든 결과: 최근 두 달만 다시
                if ym in (cur_ym, prev_ym):
                    reason = "최근 구간 갱신"
            else:
                fp = int(row[2] or 0)
                if ym == cur_ym:
                    if n - fp >= max(100, fp * 0.1) and (now_utc() - row[4]).days >= 6:
                        reason = "이번 달 리뷰가 늘어 갱신"
                elif fp and abs(n - fp) / fp >= 0.25:
                    reason = "리뷰 수가 크게 달라져 갱신"
            if reason:
                tasks.append({"kind": "monthly", "period_key": ym, "scope": scope, "reason": reason,
                              "prio": 30 + (0 if ym in (cur_ym, prev_ym) else 20) + (0 if scope == "all" else 5)})
        ym = add_month(ym)
    return tasks


def plan_game(conn, g: dict) -> list[dict]:
    appid = g["appid"]
    m = conn.execute("select metrics from game_metrics where appid = %s", (appid,)).fetchone()
    ready = bool(m and m[0].get("data_ready"))
    tasks = plan_monthly(conn, g) if ready else []      # 최신 리뷰 수집이 덜 끝난 게임은 월간 분석을 미룸
    for pk, in conn.execute("""select period_key from analyses where appid=%s and kind='shift' and scope='all'
                               and coalesce(reaction_summary, '') = '' and period_start >= current_date - 365
                               order by period_start desc limit 6""", (appid,)).fetchall():
        tasks.append({"kind": "shift_explain", "period_key": pk, "scope": "all", "reason": "급변 해설 없음", "prio": 10})
    for pk, in conn.execute("""select period_key from analyses where appid=%s and kind='event_impact' and scope='all'
                               and coalesce(reaction_summary, '') = '' and (extra->>'enough_data') = 'true'
                               order by period_start desc limit 8""", (appid,)).fetchall():
        tasks.append({"kind": "impact_explain", "period_key": pk, "scope": "all", "reason": "업데이트 영향 해설 없음", "prio": 15})
    if ready:
        week = now_utc().strftime("%G-W%V")
        fp = f"{m[0].get('diagnosis')}|{week}"
        rep = conn.execute("select input_fingerprint from game_reports where appid=%s and kind='report'", (appid,)).fetchone()
        if rep is None or rep[0] != fp:
            tasks.append({"kind": "report", "period_key": "", "scope": "all", "reason": "주간 갱신" if rep else "리포트 없음", "prio": 5, "fingerprint": fp})
    for t in tasks:
        t["appid"], t["name"] = appid, g["name"]
    return tasks


def load_games(conn, only=None) -> list[dict]:
    cols = ["appid", "name", "release_date", "top_languages", "ai_since", "last_collected_at", "review_cursor"]
    out = []
    for r in conn.execute(f"select {', '.join(cols)} from games where status = 'active' and ai_enabled order by appid").fetchall():
        g = dict(zip(cols, r))
        if only and g["appid"] not in only:
            continue
        out.append(g)
    return out


def execute(conn, g: dict, t: dict):
    kind = t["kind"]
    if kind == "monthly":
        return run_monthly(conn, g, t["period_key"], t["scope"])
    if kind == "shift_explain":
        return run_shift_explain(conn, g, t["period_key"])
    if kind == "impact_explain":
        return run_impact_explain(conn, g, t["period_key"])
    if kind == "report":
        return run_report(conn, g, t["fingerprint"])
    raise ValueError(kind)
