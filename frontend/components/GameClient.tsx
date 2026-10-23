"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart, Heatmap, LineChart, Quadrant } from "./charts";
import { Pill, Thumb } from "./ui";
import { DIAG, kst, langName, num, sign, trendClass } from "@/lib/format";
import type { Texts } from "@/lib/text-defs";

/* eslint-disable @typescript-eslint/no-explicit-any */
const IMPACT: Record<string, [string, string]> = { rebound: ["good", "반등형"], backfire: ["bad", "역풍형"], flat: ["cool", "무반응형"], unknown: ["plain", "판단 보류"] };
const BANDS: [string, string][] = [["lt2", "2시간 미만"], ["2to10", "2~10시간"], ["10to100", "10~100시간"], ["gt100", "100시간 이상"]];
const ACTIVE_BANDS: [string, string][] = [["lt2", "2시간 미만"], ["2to10", "2~10시간"], ["10to100", "10~100시간"], ["100to300", "100~300시간"], ["gt300", "300시간 이상"]];

export default function GameClient({ texts: t, data }: { texts: Texts; data: any }) {
  const { game: g, metrics: m, report } = data;
  const [tab, setTab] = useState<"sent" | "ccu" | "lang" | "active">("sent");
  const [tl, setTl] = useState<"all" | "official" | "shift" | "monthly">("all");
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

  // 차트 자료
  const weeks = data.weekly.slice(-78);
  const posSeries = weeks.map((w: any) => (w.pos + w.neg >= 30 ? Math.round((w.pos / (w.pos + w.neg)) * 1000) / 10 : null));
  const velSeries = weeks.map((w: any) => Math.round((w.pos + w.neg) / 7));
  const shiftMarks: number[] = data.timeline.shifts
    .filter((s: any) => (s.extra?.metric ?? "sentiment") === "sentiment")
    .map((s: any) => weeks.findIndex((w: any) => w.w >= String(s.date).slice(0, 10) && true)).filter((i: number) => i >= 0);
  const monthLabels: [number, string][] = [];
  weeks.forEach((w: any, i: number) => { if (i % Math.max(1, Math.round(weeks.length / 6)) === 0) monthLabels.push([i, String(w.w).slice(2, 7).replace("-", ".")]); });

  const ccuVals = data.ccuMonthly.map((r: any) => r.peak);
  const ccuMax = Math.max(10, ...ccuVals);
  const ccuLabels: [number, string][] = data.ccuMonthly.map((r: any, i: number) => [i, String(r.m).slice(2, 7).replace("-", ".")] as [number, string]).filter((_: any, i: number) => i % Math.max(1, Math.round(data.ccuMonthly.length / 6)) === 0);

  return (
    <div>
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

      <div className="card sumcard">
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
            <div className="kpi"><div className="k">활성 리뷰어</div><div className="v num">{m.active_share != null ? `${Math.round(m.active_share)}%` : "-"}</div><div className="s">긍정 리뷰어 중 30일 내 접속</div></div>
            <div className="kpi"><div className="k">최근 급변</div><div className="v num">{m.last_shift?.delta != null ? `${sign(m.last_shift.delta, 0)}pp` : "-"}</div><div className="s">{m.last_shift?.date ?? "없음"}</div></div>
            <div className="kpi"><div className="k">마지막 업데이트</div><div className="v num">{m.last_update_days != null ? `${m.last_update_days}일 전` : "-"}</div><div className="s">{m.last_update_date ?? ""}</div></div>
          </div>
        </div>
      </div>

      <div className="sec-title"><h2>타임라인</h2><span>{t.tl_sub}</span></div>
      <div className="row" role="group" aria-label="타임라인 필터">
        {([["all", "전체"], ["official", "업데이트"], ["shift", "급변"], ["monthly", "월간 요약"]] as const).map(([k, l]) => (
          <button key={k} className="chip" aria-pressed={tl === k} onClick={() => setTl(k)}>{l}</button>
        ))}
      </div>
      <p className="help" style={{ margin: "8px 0 0" }}>{t.impact_help}</p>
      <div className="tl">
        {items.length === 0 && <p className="muted">아직 표시할 항목이 없습니다. 분석이 끝나면 채워집니다.</p>}
        {items.map((x) => <TimelineCard key={x.key} x={x} />)}
      </div>

      <div className="sec-title"><h2>상세 분석</h2></div>
      <div className="card">
        <div className="tabs" role="tablist">
          {([["sent", "평가·반응"], ["ccu", "접속"], ["lang", "언어권"], ["active", "활성 리뷰어"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === "sent" && (
          <div>
            <h3>긍정률 추이 (주 단위)</h3>
            <div className="legend"><span><i />긍정률</span><span style={{ color: "var(--bad)" }}>● 급변 구간</span></div>
            <LineChart vals={posSeries} min={Math.max(0, Math.floor((Math.min(...posSeries.filter((v: number | null): v is number => v !== null), 100) - 5) / 10) * 10)} max={100}
              ticks={[50, 60, 70, 80, 90, 100]} unit="%" xl={monthLabels} marks={shiftMarks} area label="긍정률 추이" />
            <h3 style={{ marginTop: 14 }}>리뷰 속도 (주 평균, 건/일)</h3>
            <div className="legend"><span><i className="b" />하루 신규 리뷰 수</span></div>
            <BarChart vals={velSeries} label="리뷰 속도" />
            <h3 style={{ marginTop: 18 }}>키워드 × 플레이타임 구간 <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>(해당 구간 리뷰 중 언급 비율)</span></h3>
            {data.keywordBands.length === 0 ? <p className="muted">플레이타임 자료를 보충하는 중이라 아직 계산하지 않았습니다. (게임별로 플레이타임 확보율이 일정 수준을 넘으면 표시됩니다.)</p> : (
              <div className="tbl-wrap"><table><thead><tr><th>키워드</th>{BANDS.map(([, l]) => <th key={l} className="n">{l}</th>)}</tr></thead><tbody>
                {data.keywordBands.map((k: any) => (
                  <tr key={k.term}><td>{k.term}</td>{BANDS.map(([b]) => { const v = k.bands[b]; return <td key={b} className="n"><div className="hm" style={{ ["--v" as string]: Math.min((v ?? 0) / 25, 1).toFixed(2) }}>{v ?? "-"}{v != null && "%"}</div></td>; })}</tr>
                ))}
              </tbody></table></div>
            )}
            <p className="help">{t.kw_help}</p>
          </div>
        )}

        {tab === "ccu" && (
          <div>
            {data.ccuMissing && <div className="notice">{t.ccu_missing_notice}</div>}
            <h3>월별 동접 피크</h3>
            {ccuVals.length < 2 ? <p className="muted">동접 기록이 아직 부족합니다.</p> :
              <LineChart vals={ccuVals} min={0} max={ccuMax} ticks={[0, Math.round(ccuMax / 2), ccuMax]} xl={ccuLabels} area label="월별 동접 피크" />}
            <h3 style={{ marginTop: 18 }}>시간대 × 요일 평균 접속 (한국 시간)</h3>
            {data.heat ? <Heatmap cells={data.heat.map((h: any) => ({ dow: h.dow, hr: h.hr, v: h.v }))} /> : <p className="muted">시간대별 기록이 4일 이상 쌓이면 표시됩니다.</p>}
            {report?.peaktime && <p style={{ marginTop: 12 }}><span className="ai-tag" style={{ marginLeft: 0, marginRight: 6 }}>AI 해설</span>{report.peaktime}</p>}
            <p className="help">진한 칸일수록 평균 동접이 높은 시간입니다. 이 표는 숫자만으로 만들어집니다.</p>
          </div>
        )}

        {tab === "lang" && (
          <div>
            <p className="help" style={{ margin: "0 0 12px" }}>{t.lang_note}</p>
            {report?.language && <p style={{ marginBottom: 12 }}><span className="ai-tag" style={{ marginLeft: 0, marginRight: 6 }}>AI 해설</span>{report.language}</p>}
            <div className="tbl-wrap"><table><thead><tr><th>언어</th><th className="n">리뷰 수 (30일)</th><th className="n">긍정률</th><th className="n">전체 대비</th><th>해설</th></tr></thead><tbody>
              {data.langs.map((l: any) => {
                const ai = data.langAi[l.language];
                return (
                  <tr key={l.language}>
                    <td><b>{langName(l.language)}</b></td><td className="n num">{num(l.n)}</td>
                    <td className="n num">{l.pos != null ? `${l.pos.toFixed(1)}%` : "-"}</td>
                    <td className={`n num ${trendClass(l.diff)}`}>{l.diff != null ? `${sign(l.diff, 1)}pp` : "-"}</td>
                    <td style={{ minWidth: 280 }}>{ai ? <><span className="ai-tag" style={{ margin: "0 6px 0 0" }}>AI 해설 · {ai.month}</span>{ai.text}</> : l.n < 30 ? <><Pill cls="plain">표본 부족 (30건 미만)</Pill> <span className="muted">{t.lang_small}</span></> : <span className="muted">수치만 제공</span>}</td>
                  </tr>
                );
              })}
              {data.langs.length === 0 && <tr><td colSpan={5} className="muted">최근 30일 언어별 자료가 없습니다.</td></tr>}
            </tbody></table></div>
          </div>
        )}

        {tab === "active" && (
          <div>
            <h3>긍정 리뷰 작성자 중 수집 시점 30일 안에 접속한 비율</h3>
            {Object.keys(m.active_bands ?? {}).length === 0 ? <p className="muted">마지막 접속 정보를 수집하는 중입니다. 플레이타임 보충이 끝나면 표시됩니다.</p> : (
              <div className="bars">{ACTIVE_BANDS.map(([k, l]) => { const b = m.active_bands[k]; const pct = b && b.n >= 20 ? Math.round((b.active / b.n) * 100) : null;
                return <div key={k} className="bar-row"><span>{l}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${pct ?? 0}%` }} /></div><span className="num">{pct != null ? `${pct}%` : "표본 부족"}</span></div>; })}</div>
            )}
            {report?.lifecycle && <p style={{ marginTop: 14 }}><span className="ai-tag" style={{ marginLeft: 0, marginRight: 6 }}>AI 해설</span>{report.lifecycle}</p>}
            <p className="help">{t.active_help}</p>
          </div>
        )}
      </div>

      <ReviewExplorer appid={g.appid} langs={data.langs.map((l: any) => l.language)} />
    </div>
  );
}

function TimelineCard({ x }: { x: any }) {
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
    title = e.metric === "volume" ? `리뷰 급증 (${String(x.date).slice(0, 10)} ~ ${String(x.period_end ?? x.date).slice(0, 10)})` : `긍정률 ${Number(e.sentiment_delta) < 0 ? "급락" : "급등"} (${String(x.date).slice(0, 10)} ~ ${String(x.period_end ?? x.date).slice(0, 10)})`;
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
    <div className="tl-item">
      <div className="tl-date"><b>{String(x.date).slice(0, 10)}</b>{typeLabel}</div>
      <div className={`tl-card ${x.type}`}>
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
