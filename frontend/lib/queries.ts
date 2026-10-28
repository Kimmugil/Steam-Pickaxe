import { plain, sql, Row } from "./db";

const rate = (p: number, n: number, min = 20) => (p + n >= min ? Math.round((p / (p + n)) * 1000) / 10 : null);

/* ───────────────────────── 홈 ───────────────────────── */
export async function getHomeData() {
  const games = await sql`
    select g.appid, g.name, g.thumbnail, g.status, g.tier, m.metrics,
           (select body from game_reports r where r.appid = g.appid and r.kind = 'report') as report
    from games g left join game_metrics m on m.appid = g.appid
    where g.status in ('active', 'collecting') order by g.name`;
  const spark = await sql`
    select appid, (sampled_at at time zone 'UTC')::date as d, max(ccu) as peak from ccu_samples
    where sampled_at >= now() - interval '8 days' group by 1, 2 order by 1, 2`;
  const sparkBy = new Map<number, number[]>();
  for (const r of spark) {
    const k = Number(r.appid);
    sparkBy.set(k, [...(sparkBy.get(k) ?? []), Number(r.peak)]);
  }
  const [w4] = await sql`select period, body from briefs where period like 'w4:%' order by period desc limit 1`;
  const [month] = await sql`select period, body from briefs where period like 'm:%' order by period desc limit 1`;
  const nw = new Set<number>((w4?.body?.items ?? []).filter((i: Row) => i.nw).map((i: Row) => Number(i.appid)));

  const cards = games.map((g) => {
    const m: Row = g.metrics ?? {};
    let one = "";
    try { one = g.report ? JSON.parse(g.report).one_liner ?? "" : ""; } catch { /* 형식이 깨진 리포트는 무시 */ }
    if (!one) one = g.status === "collecting" ? "리뷰를 처음 수집하는 중입니다." : m.data_ready === false ? "최신 리뷰를 수집하는 중입니다." : (m.diagnosis_reasons ?? [])[0] ?? "";
    return {
      appid: Number(g.appid), name: g.name as string, thumbnail: g.thumbnail as string | null, status: g.status as string,
      diag: (m.diagnosis ?? null) as string | null, pos30: m.pos30 ?? null, velocityChange: m.velocity_change ?? null,
      velocity: m.velocity ?? null, one, spark: sparkBy.get(Number(g.appid)) ?? [], isNew: nw.has(Number(g.appid)),
      attention: Number(m.attention ?? 0), lastUpdateDays: m.last_update_days ?? null,
    };
  });
  const top = [...(w4?.body?.items ?? [])].slice(0, 3);
  return plain({ cards, w4: w4 ? { period: w4.period, ...w4.body } : null, month: month ? { period: month.period, ...month.body } : null, highlights: top });
}

/* ───────────────────────── 게임 상세 ───────────────────────── */
const BAND_CASE = sql`case when playtime_at_review < 120 then 'lt2' when playtime_at_review < 600 then '2to10'
                           when playtime_at_review < 6000 then '10to100' else 'gt100' end`;

export async function getGameData(appid: number) {
  const [g] = await sql`select * from games where appid = ${appid}`;
  if (!g) return null;
  const [mrow] = await sql`select metrics, computed_at from game_metrics where appid = ${appid}`;
  const [rrow] = await sql`select body, generated_at from game_reports where appid = ${appid} and kind = 'report'`;
  let report: Row | null = null;
  try { report = rrow?.body ? JSON.parse(rrow.body) : null; } catch { report = null; }

  const [cov] = await sql`
    select (select min(sampled_at) from ccu_samples where appid = ${appid}) as ccu_start,
           (select min(day) from review_daily where appid = ${appid}) as first_review,
           (select max(sampled_at) from ccu_samples where appid = ${appid}) as ccu_last`;

  // 타임라인: 전후 영향이 분석된 공식 업데이트 + 급변 + 월간 요약
  const impacts = await sql`
    select a.period_key, a.period_start as date, coalesce(e.title_kr, a.title) as title, e.url, a.extra, a.reaction_summary
    from analyses a left join events e on e.appid = a.appid and e.event_key = a.period_key
    where a.appid = ${appid} and a.kind = 'event_impact' order by a.period_start desc limit 12`;
  const shifts = await sql`
    select period_key, period_start as date, period_end, sentiment_rate, review_count, extra, reaction_summary, keywords, top_reviews
    from analyses where appid = ${appid} and kind = 'shift' order by period_start desc limit 12`;
  const monthly = await sql`
    select period_key, period_start as date, sentiment_rate, review_count, extra, reaction_summary, keywords, top_reviews
    from analyses where appid = ${appid} and kind = 'monthly' and scope = 'all' and not is_sparse and coalesce(reaction_summary, '') <> ''
    order by period_key desc limit 6`;

  // 차트용 주간 집계
  const weekly = await sql`
    select date_trunc('week', day)::date as w, sum(pos)::int as pos, sum(neg)::int as neg from review_daily
    where appid = ${appid} group by 1 order by 1`;
  const ccuMonthly = await sql`
    select date_trunc('month', sampled_at)::date as m, max(ccu)::int as peak from ccu_samples where appid = ${appid} group by 1 order by 1`;
  const heat = await sql`
    select extract(dow from t)::int as dow, extract(hour from t)::int as hr, avg(ccu)::float as v, count(distinct t::date)::int as days
    from (select sampled_at at time zone 'Asia/Seoul' as t, ccu from ccu_samples where appid = ${appid} and sampled_at >= now() - interval '60 days') x
    group by 1, 2`;

  // 언어권 (최근 30일) + 언어별 AI 해설
  const langs = await sql`
    select language, sum(pos)::int as pos, sum(neg)::int as neg from review_daily
    where appid = ${appid} and day >= current_date - 30 and language <> '' group by 1 order by sum(pos + neg) desc`;
  const langAi = await sql`
    select distinct on (scope) scope, reaction_summary, period_key from analyses
    where appid = ${appid} and kind = 'monthly' and scope <> 'all' and coalesce(reaction_summary, '') <> ''
    order by scope, period_key desc`;

  // 플레이타임 구간별 긍정·부정 (최근 90일, 리뷰를 쓸 때까지의 플레이타임이 기록된 리뷰만)
  // 예전에는 AI가 뽑은 키워드를 원문으로 찾아 구간별 언급 비율을 보여 줬지만, 영어 키워드가 영어 리뷰에만 걸려 결과가 한쪽으로 쏠려서 없앴다.
  let bandRates: Row[] = [];
  if (Number(g.reviews_with_playtime) > 2000) {
    bandRates = await sql`
      select ${BAND_CASE} as band, count(*) filter (where voted_up)::int as pos, count(*) filter (where not voted_up)::int as neg
      from reviews where appid = ${appid} and created_at >= now() - interval '90 days' and playtime_at_review is not null group by 1`;
  }

  const m: Row = mrow?.metrics ?? {};
  const overallPos = langs.reduce((a, r) => a + r.pos, 0);
  const overallNeg = langs.reduce((a, r) => a + r.neg, 0);
  const langTotal = overallPos + overallNeg;       // 모든 언어를 합친 최근 30일 리뷰 수 (비중 계산용)
  const ccuStart = cov.ccu_start ? new Date(cov.ccu_start) : null;
  const firstReview = cov.first_review ? new Date(cov.first_review) : null;
  const ccuMissing = !g.ccu_history_imported && (!ccuStart || (firstReview !== null && ccuStart.getTime() - firstReview.getTime() > 14 * 86400000));

  return plain({
    game: g, metrics: m, report, reportAt: rrow?.generated_at ?? null, ccuStart: cov.ccu_start, ccuLast: cov.ccu_last, ccuMissing,
    timeline: { impacts, shifts, monthly },
    weekly: weekly.map((r) => ({ w: r.w, pos: r.pos, neg: r.neg })),
    ccuMonthly,
    heat: heat.length && Math.max(...heat.map((h) => h.days)) >= 4 ? heat : null,
    langAll: { pos: overallPos, neg: overallNeg },
    langs: langs.slice(0, 10).map((r) => ({ language: r.language, n: r.pos + r.neg, pos_n: r.pos, neg_n: r.neg, share: langTotal ? Math.round(((r.pos + r.neg) / langTotal) * 1000) / 10 : null, pos: rate(r.pos, r.neg, 30), diff: rate(r.pos, r.neg, 30) !== null && rate(overallPos, overallNeg, 30) !== null ? Math.round(((rate(r.pos, r.neg, 30) as number) - (rate(overallPos, overallNeg, 30) as number)) * 10) / 10 : null })),
    langAi: Object.fromEntries(langAi.map((r) => [r.scope, { text: r.reaction_summary, month: r.period_key }])),
    bandRates,
  });
}

/* ───────────────────────── 관리자 ───────────────────────── */
export async function getAdminData() {
  const games = await sql`
    select g.appid, g.name, g.thumbnail, g.status, g.tier, g.tier_override, g.reviews_collected, g.reviews_with_playtime,
           g.steam_total_reviews, g.last_collected_at, g.next_collect_at, g.review_cursor, g.ccu_history_imported, g.ai_enabled,
           m.metrics, (select min(sampled_at) from ccu_samples c where c.appid = g.appid) as ccu_start,
           (select min(day) from review_daily d where d.appid = g.appid) as first_review,
           (select max(period_key) from analyses a where a.appid = g.appid and a.kind = 'monthly' and a.scope = 'all') as last_monthly,
           (select max(generated_at) from game_reports r where r.appid = g.appid and r.kind = 'report') as report_at,
           -- 자동 분석이 실제로 해설을 만드는 범위(급변: 최근 1년 중 최신 6건, 영향: 최신 8건)와 똑같이 센다.
           -- 범위 밖의 오래된 것까지 세면 '분석 대기'가 영원히 남는다.
           (select count(*) from (select 1 from analyses a where a.appid = g.appid and a.kind = 'shift' and a.scope = 'all'
              and coalesce(a.reaction_summary, '') = '' and a.period_start >= current_date - 365
              order by a.period_start desc limit 6) x)::int as shifts_open,
           (select count(*) from (select 1 from analyses a where a.appid = g.appid and a.kind = 'event_impact' and a.scope = 'all'
              and coalesce(a.reaction_summary, '') = '' and (a.extra->>'enough_data') = 'true'
              order by a.period_start desc limit 8) x)::int as impacts_open,
           (select count(*) from analyses a where a.appid = g.appid and a.kind = 'monthly' and a.scope <> 'all'
              and a.period_key >= to_char(now() - interval '1 month', 'YYYY-MM'))::int as lang_recent
    from games g left join game_metrics m on m.appid = g.appid order by (g.status = 'archived'), g.name`;
  const failed = await sql`
    select t.appid, g.name, t.kind, t.period_key, t.scope, t.attempts, t.last_error, t.updated_at
    from analysis_tasks t join games g on g.appid = t.appid where t.status = 'failed' order by t.updated_at desc limit 30`;
  const jobs = await sql`
    select distinct on (job) job, started_at, finished_at, ok, error, summary from job_runs order by job, started_at desc`;
  const requests = await sql`select appid, name, meta, request_count, memo, created_at from game_requests where status = 'open' order by request_count desc, created_at`;
  const [usage] = await sql`select coalesce(sum(calls), 0)::int as calls, coalesce(sum(input_tokens), 0)::bigint as inp, coalesce(sum(output_tokens), 0)::bigint as outp
                            from ai_usage where day >= date_trunc('month', current_date)`;
  const [capRow] = await sql`select value from app_settings where key = 'ai_monthly_call_cap'`;
  const [size] = await sql`select pg_database_size(current_database())::bigint as bytes`;
  return plain({ games, failed, jobs, requests, usage, cap: Number(capRow?.value ?? 600), dbBytes: Number(size.bytes) });
}
