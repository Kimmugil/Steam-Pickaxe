"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BarChart, Heatmap, LineChart, PosNeg, Quadrant, type Mark } from "./charts";
import { Pill, Thumb } from "./ui";
import { DIAG, kst, langName, num, sign, trendClass } from "@/lib/format";
import type { Texts } from "@/lib/text-defs";

/* eslint-disable @typescript-eslint/no-explicit-any */
const IMPACT: Record<string, [string, string]> = { rebound: ["good", "반등형"], backfire: ["bad", "역풍형"], flat: ["cool", "무반응형"], unknown: ["plain", "판단 보류"] };
const BANDS: [string, string][] = [["lt2", "2시간 미만"], ["2to10", "2~10시간"], ["10to100", "10~100시간"], ["gt100", "100시간 이상"]];
const ACTIVE_BANDS: [string, string][] = [["lt2", "2시간 미만"], ["2to10", "2~10시간"], ["10to100", "10~100시간"], ["100to300", "100~300시간"], ["gt300", "300시간 이상"]];

const NAV: [string, string][] = [["sec-sum", "한눈 요약"], ["sec-detail", "상세 분석"], ["sec-tl", "타임라인"], ["sec-explore", "리뷰 탐색"]];

/** 화면 오른쪽에 떠 있는 이동 메뉴. 누르면 그 영역으로 부드럽게 이동하고, 지금 보는 영역을 표시합니다. */
function FloatNav() {
  const [on, setOn] = useState(NAV[0][0]);
  useEffect(() => {
    const els = NAV.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((es) => {
      const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setOn(vis.target.id);
    }, { rootMargin: "-20% 0px -60% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <nav className="floatnav" aria-label="화면 안 이동">
      {NAV.map(([id, l]) => (
        <button key={id} className={on === id ? "on" : ""} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}><i />{l}</button>
      ))}
      <button className="up" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>↑ 맨 위</button>
    </nav>
  );
}

const shiftTitle = (x: any) => {
  const e = x.extra ?? {};
  const range = `${String(x.date).slice(0, 10)} ~ ${String(x.period_end ?? x.date).slice(0, 10)}`;
  return e.metric === "volume" ? `리뷰 급증 (${range})` : `긍정률 ${Number(e.sentiment_delta) < 0 ? "급락" : "급등"} (${range})`;
};

export default function GameClient({ texts: t, data }: { texts: Texts; data: any }) {
  const { game: g, metrics: m, report } = data;
  const [tab, setTab] = useState<"sent" | "ccu" | "lang" | "active">("sent");
  const [tl, setTl] = useState<"all" | "official" | "shift" | "monthly">("all");
  const [flash, setFlash] = useState<string | null>(null);
  const diag: string | null = m.diagnosis ?? null;
  const d = diag ? DIAG[diag] : null;
  const dLabel = diag ? t[`${DIAG[diag].key}_name`] : "분석 대기";
  const collectedPct = g.steam_total_reviews ? Math.round((g.reviews_collected / g.steam_total_reviews) * 100) : null;

  // 타임라인: 영향 분석 + 급변 + 월간 요약을 날짜순으로
  const items: any[] = [
    ...data.timeline.impacts.map((x: any) => ({ type: "official", date: x.date, key: "i" + x.period_key, ...x })),
    ...data.timeline.shifts.map((x: any) => ({ type: "shift", date: x.date, key: "s" + x.period_key, ...x })),
    ...data.timeline.monthly.map((x: any) => ({ type: "monthly", date: x.date, key: "m" + x.period_key, ...x })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date))).filter((x) => tl === "all" || x.type === tl);

  // 그래프의 급변 표시를 누르면: 필터를 '전체'로 풀고, 그 카드로 이동해서 잠깐 배경색을 바꿔 보여 줌
  const jump = useCallback((key: string) => {
    setTl("all");
    setTimeout(() => {
      document.getElementById("tl-" + key)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlash(key);
      setTimeout(() => setFlash(null), 2400);
    }, 80);
  }, []);

  // 차트 자료
  const weeks = data.weekly.slice(-78);
  const posSeries = weeks.map((w: any) => (w.pos + w.neg >= 30 ? Math.round((w.pos / (w.pos + w.neg)) * 1000) / 10 : null));
  const posTips = weeks.map((w: any) => { const n = w.pos + w.neg; return `${String(w.w).slice(0, 10)} 주 · ${n >= 30 ? `긍정률 ${posSeries[weeks.indexOf(w)]}%` : "리뷰가 적어 표시 안 함"} (리뷰 ${num(n)}건)`; });
  const velSeries = weeks.map((w: any) => Math.round((w.pos + w.neg) / 7));
  const velTips = weeks.map((w: any, i: number) => `${String(w.w).slice(0, 10)} 주 · 하루 평균 ${velSeries[i]}건 (주 ${num(w.pos + w.neg)}건)`);
  const shiftMarks: Mark[] = data.timeline.shifts
    .filter((s: any) => (s.extra?.metric ?? "sentiment") === "sentiment")
    .map((s: any) => ({ i: weeks.findIndex((w: any) => w.w >= String(s.date).slice(0, 10)), label: `${shiftTitle(s)} · ${sign(s.extra?.sentiment_delta, 1)}pp — 눌러서 아래 카드로 이동`, onClick: () => jump("s" + s.period_key) }))
    .filter((x: Mark) => x.i >= 0);
  const monthLabels: [number, string][] = [];
  weeks.forEach((w: any, i: number) => { if (i % Math.max(1, Math.round(weeks.length / 6)) === 0) monthLabels.push([i, String(w.w).slice(2, 7).replace("-", ".")]); });

  const ccuVals = data.ccuMonthly.map((r: any) => r.peak);
  const ccuTips = data.ccuMonthly.map((r: any) => `${String(r.m).slice(0, 7)} · 동접 피크 ${num(r.peak)}명`);
  const ccuMax = Math.max(10, ...ccuVals);
  const ccuLabels: [number, string][] = data.ccuMonthly.map((r: any, i: number) => [i, String(r.m).slice(2, 7).replace("-", ".")] as [number, string]).filter((_: any, i: number) => i % Math.max(1, Math.round(data.ccuMonthly.length / 6)) === 0);

  const bandRate = (k: string) => data.bandRates.find((r: any) => r.band === k);
  const langTotal = data.langs.reduce((a: number, l: any) => a + l.n, 0);

  return (
    <div>
      <FloatNav />
      <Link href="/" className="back">← 홈으로</Link>
      <div className="ghead">
        <Thumb appid={g.appid} name={g.name} src={g.thumbnail} size="xl" />
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1>{g.name}</h1>
          <div className="meta">
            {g.genres?.length > 0 && <span>{g.genres.join(" · ")}</span>}
            {(g.release_date || g.release_date_text) && <span>출시 {g.release_date ? String(g.release_date).slice(0, 10) : g.release_date_text}</span>}
            {g.developer && <span>{g.developer}</span>}
            <span>{g.is_free ? "무료" : g.price ?? "-"}</span>
          </div>
          <div className="cover">
            <span className="pill plain nodot">리뷰 수집 <b className="num">{num(g.reviews_collected)}</b> / Steam 전체 <b className="num">{num(g.steam_total_reviews)}</b>{collectedPct !== null && ` (${collectedPct}%)`}</span>
            <span className="pill plain nodot">마지막 수집 {g.last_collected_at ? kst(g.last_collected_at) : "아직 없음"}</span>
            {data.ccuStart && <span className="pill plain nodot">동접 기록 시작 <b className="num">{String(data.ccuStart).slice(0, 10)}</b></span>}
            {g.status === "archived" ? <Pill cls="plain">보관됨</Pill> : g.review_cursor ? <Pill cls="warn">과거 리뷰 보충 중</Pill> : <Pill cls="good">수집 정상</Pill>}
          </div>
        </div>
      </div>

      <div id="sec-sum" className="card sumcard">
        <div>
          {d ? <Pill cls={d.cls} title={t[`${d.key}_help`]}>{dLabel}</Pill> : <Pill cls="plain">{dLabel}</Pill>}
          <Quadrant diag={diag} />
        </div>
        <div>
          <h3>{t.sum_title}<span className="ai-tag">{t.ai_tag}</span></h3>
          {report?.bullets?.length ? <ul className="bullets">{report.bullets.map((b: string, i: number) => <li key={i}>{b}</li>)}</ul>
            : <p className="muted" style={{ marginTop: 8 }}>{(m.diagnosis_reasons ?? [])[0] ?? "AI 요약은 최신 리뷰 수집이 끝나면 만들어집니다."}</p>}
        </div>
        <div>
          <h3>핵심 숫자 <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>(최근 30일 기준)</span></h3>
          <div className="kpis">
            <div className="kpi"><div className="k">긍정률 ({m.pos_window_days ?? 30}일)</div><div className="v num">{m.pos30 ?? "-"}{m.pos30 != null && "%"}</div><div className="s">Steam 누적 {m.steam_positive_rate != null ? `${Math.round(m.steam_positive_rate)}%` : "-"}</div></div>
            <div className="kpi"><div className="k">리뷰 속도</div><div className="v num">{m.velocity != null ? Math.round(m.velocity) : "-"}/일</div><div className="s">직전 30일 대비 {m.velocity_change != null ? `${sign(m.velocity_change)}%` : "-"}</div></div>
            <div className="kpi"><div className="k">동접 (최근)</div><div className="v num">{m.ccu_now != null ? num(m.ccu_now) : "-"}</div><div className="s">역대 피크 대비 {m.ccu_pct_of_peak != null ? `${m.ccu_pct_of_peak}%` : "-"}</div></div>
            <div className="kpi"><div className="k">활성 리뷰어</div><div className="v num">{m.active_share != null ? `${Math.round(m.active_share)}%` : "-"}</div><div className="s">긍정 리뷰어 중 수집 시점 30일 내 접속 (자세한 설명은 상세 분석의 활성 리뷰어 탭)</div></div>
            <div className="kpi"><div className="k">최근 급변</div><div className="v num">{m.last_shift?.delta != null ? `${sign(m.last_shift.delta, 0)}pp` : "-"}</div><div className="s">{m.last_shift?.date ?? "없음"}</div></div>
            <div className="kpi"><div className="k">마지막 업데이트</div><div className="v num">{m.last_update_days != null ? `${m.last_update_days}일 전` : "-"}</div><div className="s">{m.last_update_date ?? ""}</div></div>
          </div>
        </div>
      </div>

      <div id="sec-detail" className="sec-title"><h2>상세 분석</h2><span>전체 흐름을 먼저 보고, 아래 타임라인에서 그 시기에 무슨 일이 있었는지 확인합니다</span></div>
      <div className="card">
        <div className="tabs" role="tablist">
          {([["sent", "평가·반응"], ["ccu", "접속"], ["lang", "언어권"], ["active", "활성 리뷰어"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === "sent" && (
          <div>
            <h3>긍정률 추이 (주 단위)</h3>
            <div className="legend"><span><i />긍정률</span><span style={{ color: "var(--bad)" }}>● 급변 구간 (마우스를 올리면 내용, 누르면 아래 타임라인 카드로 이동)</span></div>
            <LineChart vals={posSeries} pts={posTips} min={Math.max(0, Math.floor((Math.min(...posSeries.filter((v: number | null): v is number => v !== null), 100) - 5) / 10) * 10)} max={100}
              ticks={[50, 60, 70, 80, 90, 100]} unit="%" xl={monthLabels} marks={shiftMarks} area label="긍정률 추이" />
            <p className="help" style={{ marginTop: 4 }}>그 주에 달린 리뷰 중 긍정의 비율입니다. 한 주 리뷰가 30건 미만이면 점을 찍지 않아요.</p>

            <h3 style={{ marginTop: 18 }}>리뷰 속도 (주 평균, 건/일)</h3>
            <BarChart vals={velSeries} pts={velTips} label="리뷰 속도" />
            <p className="help" style={{ marginTop: 4 }}>하루에 새 리뷰가 평균 몇 건 달렸는지입니다. 게임이 얼마나 화제가 되는지를 보는 간접 지표예요(리뷰는 플레이어 전체가 아니라 일부만 남깁니다). 세일·업데이트·화제가 되면 튀고, 오래된 게임은 서서히 낮아지는 게 보통이에요. 위 '긍정률 추이'와 같은 시기에 같이 움직였는지를 보세요.</p>

            <h3 style={{ marginTop: 18 }}>플레이타임 구간별 긍정률 <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>(최근 90일 리뷰)</span></h3>
            {data.bandRates.length === 0 ? <p className="muted">플레이타임 자료를 보충하는 중이라 아직 계산하지 않았습니다. (게임별로 플레이타임 확보율이 일정 수준을 넘으면 표시됩니다.)</p> : (
              <div className="bandrows">
                {BANDS.map(([k, l]) => { const b = bandRate(k); const n = b ? b.pos + b.neg : 0; return (
                  <div key={k} className="bandrow"><span className="bl">{l}</span>{n >= 20 ? <PosNeg pos={b.pos} neg={b.neg} /> : <span className="muted small">표본 부족 (20건 미만)</span>}<span className="muted small n">{num(n)}건</span></div>
                ); })}
              </div>
            )}
            <p className="help">{t.kw_help}</p>
          </div>
        )}

        {tab === "ccu" && (
          <div>
            {data.ccuMissing && <div className="notice">{t.ccu_missing_notice}</div>}
            <h3>월별 동접 피크</h3>
            {ccuVals.length < 2 ? <p className="muted">동접 기록이 아직 부족합니다.</p> :
              <LineChart vals={ccuVals} pts={ccuTips} min={0} max={ccuMax} ticks={[0, Math.round(ccuMax / 2), ccuMax]} xl={ccuLabels} area label="월별 동접 피크" />}
            <p className="help" style={{ marginTop: 4 }}>한 달 동안 동시에 접속한 사람 수가 가장 많았던 때의 숫자입니다. (Steam 접속자만, 다른 플랫폼 제외)</p>
            {data.heat && (
              <>
                <h3 style={{ marginTop: 18 }}>시간대 × 요일 평균 접속 (한국 시간)</h3>
                <Heatmap cells={data.heat.map((h: any) => ({ dow: h.dow, hr: h.hr, v: h.v }))} />
                {report?.peaktime && <p style={{ marginTop: 12 }}><span className="ai-tag" style={{ marginLeft: 0, marginRight: 6 }}>AI 해설</span>{report.peaktime}</p>}
                <p className="help">진한 칸일수록 평균 동접이 높은 시간입니다. 이 표는 숫자만으로 만들어집니다.</p>
              </>
            )}
          </div>
        )}

        {tab === "lang" && (
          <div>
            <p className="help" style={{ margin: "0 0 12px" }}>{t.lang_note}</p>
            {report?.language && <p style={{ marginBottom: 12 }}><span className="ai-tag" style={{ marginLeft: 0, marginRight: 6 }}>AI 해설</span>{report.language}</p>}
            {data.langs.length === 0 ? <p className="muted">최근 30일 언어별 자료가 없습니다.</p> : (
              <div className="langrows">
                <div className="langrow head muted small"><span>언어</span><span>최근 30일 리뷰 비중 (전체의 몇 %)</span><span>긍정·부정</span><span>전체 대비</span></div>
                {data.langs.map((l: any) => {
                  const ai = data.langAi[l.language];
                  const share = l.share ?? (langTotal ? Math.round((l.n / langTotal) * 1000) / 10 : 0);
                  return (
                    <div key={l.language} className="langitem">
                      <div className="langrow">
                        <b>{langName(l.language)}</b>
                        <div className="sharebar"><i style={{ width: `${Math.min(100, share * (100 / Math.max(...data.langs.map((x: any) => x.share ?? 0), 1)))}%` }} /><span className="num">{share}% <small className="muted">({num(l.n)}건)</small></span></div>
                        {l.n >= 30 ? <PosNeg pos={l.pos_n} neg={l.neg_n} /> : <span className="muted small">표본 부족</span>}
                        <span className={`num ${trendClass(l.diff)}`}>{l.diff != null ? `${sign(l.diff, 1)}pp` : "-"}</span>
                      </div>
                      <div className="langnote small">{ai ? <><span className="ai-tag" style={{ margin: "0 6px 0 0" }}>AI 해설 · {ai.month}</span>{ai.text}</> : l.n < 30 ? <span className="muted">{t.lang_small} (30건 미만)</span> : <span className="muted">수치만 제공</span>}</div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="help">비중은 최근 30일 동안 달린 모든 언어의 리뷰 중 그 언어가 차지하는 비율이에요. 긍정·부정 막대는 그 언어 리뷰 안에서의 비율이고, '전체 대비'는 모든 언어 평균 긍정률과의 차이(%p)입니다.</p>
          </div>
        )}

        {tab === "active" && (
          <div>
            <h3>긍정 리뷰를 쓴 사람 중, 지금도 게임을 하는 사람의 비율</h3>
            <p className="help" style={{ margin: "4px 0 12px" }}>
              <b>어떻게 계산하나요?</b> 긍정(추천) 리뷰를 쓴 사람마다 "스팀이 알려 주는 마지막 실행 시각"을 봅니다. 우리가 그 리뷰를 수집한 날 기준으로 <b>30일 안에 게임을 실행한 적이 있으면 '활성'</b>입니다.
              구간은 그 사람이 리뷰를 쓸 때까지 쌓은 플레이타임이에요. 예를 들어 "300시간 이상 49%"는, 300시간 넘게 하고 긍정 리뷰를 남긴 사람 100명 중 49명이 최근 30일 안에도 게임을 켰다는 뜻입니다.
              <b> 평균 플레이타임이 아닙니다.</b> 열심히 한 사람이 아직 남아 있는지(이탈했는지)를 보는 지표예요.
            </p>
            {Object.keys(m.active_bands ?? {}).length === 0 ? <p className="muted">마지막 접속 정보를 수집하는 중입니다. 플레이타임 보충이 끝나면 표시됩니다.</p> : (
              <div className="bars">{ACTIVE_BANDS.map(([k, l]) => { const b = m.active_bands[k]; const pct = b && b.n >= 20 ? Math.round((b.active / b.n) * 100) : null;
                return <div key={k} className="bar-row"><span>{l}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${pct ?? 0}%` }} /></div><span className="num">{pct != null ? `${pct}%` : "표본 부족"}{b && b.n > 0 && <small className="muted"> ({num(b.active)}/{num(b.n)}명)</small>}</span></div>; })}</div>
            )}
            {m.active_share != null && <p style={{ marginTop: 10 }}>전체 구간을 합치면 <b className="num">{Math.round(m.active_share)}%</b> ({num(m.active_n)}명 기준)입니다.</p>}
            {report?.lifecycle && <p style={{ marginTop: 14 }}><span className="ai-tag" style={{ marginLeft: 0, marginRight: 6 }}>AI 해설</span>{report.lifecycle}</p>}
            <p className="help">{t.active_help} 주의: 리뷰를 오래전에 쓴 사람은 그만큼 시간이 지났기 때문에, 오래된 게임일수록 전체 숫자가 낮게 나오는 경향이 있어요. 같은 게임의 구간끼리, 또는 비슷한 시기에 나온 게임끼리 비교하는 게 좋습니다.</p>
          </div>
        )}
      </div>

      <div id="sec-tl" className="sec-title"><h2>타임라인</h2><span>{t.tl_sub}</span></div>
      <div className="row" role="group" aria-label="타임라인 필터">
        {([["all", "전체"], ["official", "업데이트"], ["shift", "급변"], ["monthly", "월간 요약"]] as const).map(([k, l]) => (
          <button key={k} className="chip" aria-pressed={tl === k} onClick={() => setTl(k)}>{l}</button>
        ))}
      </div>
      <p className="help" style={{ margin: "8px 0 0" }}>{t.impact_help}</p>
      <div className="tl">
        {items.length === 0 && <p className="muted">아직 표시할 항목이 없습니다. 분석이 끝나면 채워집니다.</p>}
        {items.map((x) => <TimelineCard key={x.key} x={x} flash={flash === x.key} />)}
      </div>

      <div id="sec-explore"><ReviewExplorer appid={g.appid} langs={data.langs.map((l: any) => l.language)} /></div>
    </div>
  );
}

function TimelineCard({ x, flash }: { x: any; flash?: boolean }) {
  const e = x.extra ?? {};
  let title = x.title ?? "", facts: [string, string][] = [], kw: string[] = x.keywords ?? [], impact: [string, string] | null = null;
  const typeLabel = x.type === "official" ? "공식 업데이트" : x.type === "shift" ? (e.metric === "volume" ? "리뷰 급증" : "평가 급변") : "월간 요약";
  if (x.type === "official") {
    impact = IMPACT[e.impact] ?? null;
    facts = [
      ["리뷰 속도", `${e.velocity_before ?? "-"} → ${e.velocity_after ?? "-"}/일 (${e.velocity_change != null ? sign(e.velocity_change) + "%" : "-"})`],
      ["긍정률", `${e.pos_before ?? "-"} → ${e.pos_after ?? "-"}%`],
      ["동접 피크", e.ccu_change != null ? `${num(e.ccu_peak_before)} → ${num(e.ccu_peak_after)} (${sign(e.ccu_change)}%)` : "자료 부족"],
      ["업데이트 언급 리뷰", e.mention?.rate != null ? `${e.mention.rate}% (${e.mention.hit}건)` : "-"],
    ];
  } else if (x.type === "shift") {
    title = shiftTitle(x);
    impact = e.metric === "volume" ? null : [Number(e.sentiment_delta) < 0 ? "bad" : "good", Number(e.sentiment_delta) < 0 ? "급락" : "회복"];
    facts = e.metric === "volume"
      ? [["하루 평균 리뷰", `${e.baseline_per_day} → ${e.window_per_day}건`], ["배수", `${e.ratio}배`], ["구간 리뷰", `${num(x.review_count)}건`]]
      : [["긍정률", `${e.sentiment_before}% → ${x.sentiment_rate}% (${sign(e.sentiment_delta, 1)}pp)`], ["구간 리뷰", `${num(x.review_count)}건`], ["감지 신뢰도", e.confidence === "high" ? "높음" : e.confidence === "medium" ? "보통" : "낮음"]];
  } else {
    title = `${x.period_key} 월간 요약`;
    facts = [["긍정률", x.sentiment_rate != null ? `${x.sentiment_rate}%` : "-"], ["리뷰 수", `${num(x.review_count)}건`]];
  }
  const top: any[] = x.top_reviews ?? [];
  return (
    <div className="tl-item" id={`tl-${x.key}`}>
      <div className="tl-date"><b>{String(x.date).slice(0, 10)}</b>{typeLabel}</div>
      <div className={`tl-card ${x.type}${flash ? " flash" : ""}`}>
        <h3>{x.url ? <a href={x.url} target="_blank" rel="noreferrer">{title}</a> : title}{impact && <Pill cls={impact[0]}>{impact[1]}</Pill>}</h3>
        {e.overlapping_events > 0 && <p className="muted" style={{ fontSize: 12 }}>같은 주에 다른 공지 {e.overlapping_events}건이 겹쳐 단독 효과는 분명하지 않을 수 있습니다.</p>}
        <div className="facts">{facts.map(([k, v]) => <div key={k} className="fact"><div className="k">{k}</div><div className="v">{v}</div></div>)}</div>
        {x.reaction_summary ? <p>{x.reaction_summary}<span className="ai-tag">AI 해설</span></p> : <p className="muted">AI 해설을 준비 중입니다.</p>}
        {x.type === "monthly" && e.update_summary && <p style={{ marginTop: 6 }}><b>업데이트:</b> {e.update_summary}</p>}
        {kw.length > 0 && <div className="kw">{kw.map((k, i) => <span key={i}>{k}</span>)}</div>}
        {top.length > 0 && (
          <details className="evi"><summary>근거 리뷰 {top.length}건 보기</summary>
            {top.map((r, i) => <div key={r.id ?? i} className="quote">{r.text_kr || r.text}<small>{r.language} · {r.voted_up ? "긍정" : "부정"}{r.text_kr && r.text !== r.text_kr ? ` · 원문: ${String(r.text).slice(0, 80)}${String(r.text).length > 80 ? "…" : ""}` : ""}</small></div>)}
          </details>
        )}
      </div>
    </div>
  );
}

function ReviewExplorer({ appid, langs }: { appid: number; langs: string[] }) {
  const [f, setF] = useState({ period: "all", lang: "all", band: "all", vote: "all" });
  const [rows, setRows] = useState<any[] | null>(null);
  const [page, setPage] = useState(0);
  useEffect(() => {
    let live = true;
    setRows(null);
    const qs = new URLSearchParams({ appid: String(appid), ...f, page: String(page) });
    fetch(`/api/reviews?${qs}`).then((r) => r.json()).then((j) => { if (live) setRows(j.rows ?? []); }).catch(() => live && setRows([]));
    return () => { live = false; };
  }, [appid, f, page]);
  const set = (k: string, v: string) => { setPage(0); setF({ ...f, [k]: v }); };
  return (
    <>
      <div className="sec-title"><h2>리뷰 탐색</h2><span>조건별로 최신 리뷰 원문을 봅니다</span></div>
      <div className="card">
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <label>기간 <select value={f.period} onChange={(e) => set("period", e.target.value)}><option value="all">전체</option><option value="30">최근 30일</option><option value="7">최근 7일</option></select></label>
          <label>언어 <select value={f.lang} onChange={(e) => set("lang", e.target.value)}><option value="all">전체</option>{langs.map((l) => <option key={l} value={l}>{langName(l)}</option>)}</select></label>
          <label>플레이타임 <select value={f.band} onChange={(e) => set("band", e.target.value)}><option value="all">전체</option><option value="lt2">2시간 미만</option><option value="2to100">2~100시간</option><option value="gt100">100시간 이상</option></select></label>
          <label>평가 <select value={f.vote} onChange={(e) => set("vote", e.target.value)}><option value="all">전체</option><option value="up">긍정</option><option value="down">부정</option></select></label>
        </div>
        <div className="bars">
          {rows === null && <p className="muted">불러오는 중…</p>}
          {rows?.length === 0 && <p className="muted">조건에 맞는 리뷰가 없습니다.{f.band !== "all" && " (플레이타임을 아직 수집하지 못한 리뷰는 이 조건에서 빠집니다.)"}</p>}
          {rows?.map((r) => (
            <div key={r.id} className="rv">
              <div className="meta2"><Pill cls={r.up ? "good" : "bad"}>{r.up ? "긍정" : "부정"}</Pill><span>{langName(r.lang)}</span>{r.hours != null && <span>플레이타임 {r.hours}시간</span>}<span>{String(r.at).slice(0, 10)}</span>{r.votes > 0 && <span>추천 {r.votes}</span>}</div>
              <div>{r.text}</div>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 12, justifyContent: "flex-end" }}>
          <button className="btn small" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button>
          <span className="muted" style={{ fontSize: 12 }}>{page + 1}쪽</span>
          <button className="btn small" disabled={!rows || rows.length < 20} onClick={() => setPage(page + 1)}>다음</button>
        </div>
      </div>
    </>
  );
}
