"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ComboChart, Donut, Heatmap, LineChart, PosNeg, Quadrant, type Mark, type Slice } from "./charts";
import { Info } from "./info";
import { Pill, Thumb } from "./ui";
import { DIAG, kst, langName, num, sign, trendClass } from "@/lib/format";
import type { Texts } from "@/lib/text-defs";

/* eslint-disable @typescript-eslint/no-explicit-any */
const IMPACT: Record<string, [string, string]> = { rebound: ["good", "반등형"], backfire: ["bad", "역풍형"], flat: ["cool", "무반응형"], unknown: ["plain", "판단 보류"] };
const BANDS: [string, string][] = [["lt2", "2시간 미만"], ["2to10", "2~10시간"], ["10to100", "10~100시간"], ["gt100", "100시간 이상"]];
const ACTIVE_BANDS: [string, string][] = [["lt2", "2시간 미만"], ["2to10", "2~10시간"], ["10to100", "10~100시간"], ["100to300", "100~300시간"], ["gt300", "300시간 이상"]];
const PALETTE = ["#3b82a0", "#e0933c", "#6a9f58", "#b0629b", "#7a74c9", "#c4695a", "#4aa7a0", "#b5a145"];
const OTHER_COLOR = "#8a97a3";

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
        <button key={id} className={on === id ? "on" : ""} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}><i /><span>{l}</span></button>
      ))}
      <button className="up" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>↑<span> 맨 위</span></button>
    </nav>
  );
}

const shiftTitle = (x: any) => {
  const e = x.extra ?? {};
  const range = `${String(x.date).slice(0, 10)} ~ ${String(x.period_end ?? x.date).slice(0, 10)}`;
  return e.metric === "volume" ? `리뷰 급증 (${range})` : `긍정률 ${Number(e.sentiment_delta) < 0 ? "급락" : "회복"} (${range})`;
};
/** 급변 항목의 방향: 긍정률이 내려가면 down(빨강), 올라가면 up(초록), 리뷰 수 급증은 vol(주황) */
const shiftTone = (x: any): "down" | "up" | "vol" => ((x.extra ?? {}).metric === "volume" ? "vol" : Number((x.extra ?? {}).sentiment_delta) < 0 ? "down" : "up");

/** 눈금용: 최대값을 보기 좋은 숫자(1·2·5 단위)로 올림 */
function niceCeil(v: number) {
  if (v <= 0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

/** 'AI가 쓴 해설'은 본문보다 눈에 띄게, '읽는 법'은 ⓘ 안으로 */
function AiBox({ label = "AI 해설", children }: { label?: string; children: React.ReactNode }) {
  return <div className="aibox"><span className="lab">{label}</span>{children}</div>;
}

export default function GameClient({ texts: t, data }: { texts: Texts; data: any }) {
  const { game: g, metrics: m, report } = data;
  const [tab, setTab] = useState<"sent" | "ccu" | "lang" | "active">("sent");
  const [tl, setTl] = useState<"all" | "official" | "shift" | "monthly">("all");
  const [desc, setDesc] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [selLang, setSelLang] = useState<string | null>(null);
  const diag: string | null = m.diagnosis ?? null;
  const d = diag ? DIAG[diag] : null;
  const dLabel = diag ? t[`${DIAG[diag].key}_name`] : "분석 대기";
  const collectedPct = g.steam_total_reviews ? Math.round((g.reviews_collected / g.steam_total_reviews) * 100) : null;

  // 타임라인: 영향 분석 + 급변 + 월간 요약을 날짜순으로
  const allItems: any[] = [
    ...data.timeline.impacts.map((x: any) => ({ type: "official", date: x.date, key: "i" + x.period_key, ...x })),
    ...data.timeline.shifts.map((x: any) => ({ type: "shift", date: x.date, key: "s" + x.period_key, ...x })),
    ...data.timeline.monthly.map((x: any) => ({ type: "monthly", date: x.date, key: "m" + x.period_key, ...x })),
  ];
  const cnt = (k: string) => (k === "all" ? allItems.length : allItems.filter((x) => x.type === k).length);
  const items = allItems
    .filter((x) => tl === "all" || x.type === tl)
    .sort((a, b) => (desc ? 1 : -1) * String(b.date).localeCompare(String(a.date)));

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
  const velSeries: number[] = weeks.map((w: any) => Math.round((w.pos + w.neg) / 7));
  const velMax = niceCeil(Math.max(1, ...velSeries));
  const comboTips = weeks.map((w: any, i: number) => {
    const n = w.pos + w.neg;
    return `${String(w.w).slice(0, 10)} 주 · ${posSeries[i] != null ? `긍정률 ${posSeries[i]}%` : "긍정률 표시 안 함(리뷰 30건 미만)"} · 하루 평균 리뷰 ${velSeries[i]}건 (주 ${num(n)}건)`;
  });
  const shiftMarks: Mark[] = data.timeline.shifts
    .filter((s: any) => (s.extra?.metric ?? "sentiment") === "sentiment")
    .map((s: any) => ({
      i: weeks.findIndex((w: any) => w.w >= String(s.date).slice(0, 10)), tone: shiftTone(s) === "down" ? "bad" : "good",
      label: `${shiftTitle(s)} · ${sign(s.extra?.sentiment_delta, 1)}pp — 눌러서 아래 카드로 이동`, onClick: () => jump("s" + s.period_key),
    }))
    .filter((x: Mark) => x.i >= 0);
  const posMin = Math.max(0, Math.floor((Math.min(...posSeries.filter((v: number | null): v is number => v !== null), 100) - 5) / 10) * 10);
  const posTicks = [posMin, ...[50, 60, 70, 80, 90, 100].filter((v) => v > posMin)];
  const monthLabels: [number, string][] = [];
  weeks.forEach((w: any, i: number) => { if (i % Math.max(1, Math.round(weeks.length / 6)) === 0) monthLabels.push([i, String(w.w).slice(2, 7).replace("-", ".")]); });

  const ccuVals = data.ccuMonthly.map((r: any) => r.peak);
  const ccuTips = data.ccuMonthly.map((r: any) => `${String(r.m).slice(0, 7)} · 동접 피크 ${num(r.peak)}명`);
  const ccuMax = Math.max(10, ...ccuVals);
  const ccuLabels: [number, string][] = data.ccuMonthly.map((r: any, i: number) => [i, String(r.m).slice(2, 7).replace("-", ".")] as [number, string]).filter((_: any, i: number) => i % Math.max(1, Math.round(data.ccuMonthly.length / 6)) === 0);

  const bandRate = (k: string) => data.bandRates.find((r: any) => r.band === k);

  // 언어권: 상위 7개 + 나머지는 '기타'로 묶어 도넛에 표시
  const langs: any[] = data.langs;
  const lAll = data.langAll ?? { pos: 0, neg: 0 };
  const lTotal = lAll.pos + lAll.neg;
  const lAllRate = lTotal ? Math.round((lAll.pos / lTotal) * 1000) / 10 : null;
  const topL = langs.slice(0, 7);
  const sliceVals = topL.map((l) => l.share ?? 0);
  const otherShare = Math.max(0, Math.round((100 - sliceVals.reduce((a, b) => a + b, 0)) * 10) / 10);
  const slices: Slice[] = [
    ...topL.map((l, i) => ({ key: l.language, label: langName(l.language), value: l.share ?? 0, color: PALETTE[i] })),
    ...(otherShare >= 0.5 ? [{ key: "_other", label: "기타 언어", value: otherShare, color: OTHER_COLOR }] : []),
  ];
  const selL = langs.find((l) => l.language === selLang) ?? null;
  const selAi = selL ? data.langAi[selL.language] : null;

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
          <h3 className="hrow">{t.sum_title}<span className="ai-tag">{t.ai_tag}</span></h3>
          {report?.bullets?.length ? <ul className="bullets">{report.bullets.map((b: string, i: number) => <li key={i}>{b}</li>)}</ul>
            : <p className="muted" style={{ marginTop: 8 }}>{(m.diagnosis_reasons ?? [])[0] ?? "AI 요약은 최신 리뷰 수집이 끝나면 만들어집니다."}</p>}
        </div>
        <div>
          <h3 className="hrow">핵심 숫자 <span className="muted small">최근 30일</span></h3>
          <dl className="kpis">
            <div><dt>긍정률</dt><dd className="num">{m.pos30 ?? "-"}{m.pos30 != null && "%"}</dd><small>Steam 누적 {m.steam_positive_rate != null ? `${Math.round(m.steam_positive_rate)}%` : "-"}</small></div>
            <div><dt>리뷰 속도</dt><dd className="num">{m.velocity != null ? Math.round(m.velocity) : "-"}<small>/일</small></dd><small>직전 30일 대비 {m.velocity_change != null ? `${sign(m.velocity_change)}%` : "-"}</small></div>
            <div><dt>동접(최근)</dt><dd className="num">{m.ccu_now != null ? num(m.ccu_now) : "-"}</dd><small>역대 피크의 {m.ccu_pct_of_peak != null ? `${m.ccu_pct_of_peak}%` : "-"}</small></div>
            <div><dt>활성 리뷰어</dt><dd className="num">{m.active_share != null ? `${Math.round(m.active_share)}%` : "-"}</dd><small>긍정 리뷰어 중 최근 접속</small></div>
            <div><dt>최근 급변</dt><dd className={`num ${m.last_shift?.delta != null ? (m.last_shift.delta < 0 ? "down" : "up") : ""}`}>{m.last_shift?.delta != null ? `${sign(m.last_shift.delta, 0)}pp` : "-"}</dd><small>{m.last_shift?.date ?? "없음"}</small></div>
            <div><dt>마지막 업데이트</dt><dd className="num">{m.last_update_days != null ? `${m.last_update_days}일 전` : "-"}</dd><small>{m.last_update_date ?? ""}</small></div>
          </dl>
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
            <div className="hrow">
              <h3>긍정률과 리뷰 속도 <span className="muted small">주 단위 · 같이 움직였는지 보세요</span></h3>
              <Info title="이 그래프는 어떻게 읽나요?">
                <p><b>선(왼쪽 축)</b>은 그 주에 달린 리뷰 중 긍정의 비율이에요. 한 주 리뷰가 30건 미만이면 점을 찍지 않아요.</p>
                <p><b>막대(오른쪽 축)</b>은 하루 평균 새 리뷰 수예요. 게임이 얼마나 화제가 되는지를 보는 간접 지표입니다(리뷰는 플레이어 일부만 남겨요). 세일·업데이트·화제가 되면 튀고, 오래된 게임은 서서히 낮아지는 게 보통이에요.</p>
                <p><b>색깔 점</b>은 긍정률이 급하게 변한 시기예요. 빨강은 떨어진 때, 초록은 오른(회복한) 때입니다. 마우스를 올리면 내용이 뜨고, 누르면 아래 타임라인 카드로 이동해요.</p>
                <p>예를 들어 막대가 솟은 주에 선이 떨어졌다면, 사람이 몰리면서 불만도 같이 늘었다는 뜻일 수 있어요.</p>
              </Info>
            </div>
            <div className="legend"><span><i />긍정률 (왼쪽 축, %)</span><span><i className="b" />하루 평균 리뷰 (오른쪽 축, 건)</span><span style={{ color: "var(--bad)" }}>● 급락</span><span style={{ color: "var(--good)" }}>● 회복</span></div>
            <ComboChart line={posSeries} bars={velSeries} pts={comboTips} lineMin={posMin} lineMax={100} lineTicks={posTicks} barMax={velMax} xl={monthLabels} marks={shiftMarks} label="긍정률과 리뷰 속도" />

            <div className="hrow sepline">
              <h3>플레이타임 구간별 긍정률 <span className="muted small">최근 90일 리뷰</span></h3>
              <Info title="이 표는 무엇인가요?"><p>{t.kw_help}</p></Info>
            </div>
            {data.bandRates.length === 0 ? <p className="muted small">플레이타임 자료를 보충하는 중이라 아직 계산하지 않았습니다.</p> : (
              <div className="bandrows">
                {BANDS.map(([k, l]) => { const b = bandRate(k); const n = b ? b.pos + b.neg : 0; return (
                  <div key={k} className="bandrow"><span className="bl">{l}</span>{n >= 20 ? <PosNeg pos={b.pos} neg={b.neg} /> : <span className="muted small">표본 부족 (20건 미만)</span>}<span className="muted small n">{num(n)}건</span></div>
                ); })}
              </div>
            )}
          </div>
        )}

        {tab === "ccu" && (
          <div>
            {data.ccuMissing && <div className="notice">{t.ccu_missing_notice}</div>}
            <div className="hrow">
              <h3>월별 동접 피크</h3>
              <Info title="동접 피크란?"><p>한 달 동안 동시에 접속한 사람 수가 가장 많았던 때의 숫자입니다. Steam 접속자만 세고 다른 플랫폼은 포함하지 않아요.</p></Info>
            </div>
            {ccuVals.length < 2 ? <p className="muted">동접 기록이 아직 부족합니다.</p> :
              <LineChart vals={ccuVals} pts={ccuTips} min={0} max={ccuMax} ticks={[0, Math.round(ccuMax / 2), ccuMax]} xl={ccuLabels} area label="월별 동접 피크" />}
            {data.heat && (
              <>
                <div className="hrow sepline">
                  <h3>시간대 × 요일 평균 접속 <span className="muted small">한국 시간</span></h3>
                  <Info title="이 표는 어떻게 읽나요?"><p>진한 칸일수록 평균 동접이 높은 시간입니다. 이 표는 숫자만으로 만들어지고 AI는 관여하지 않아요.</p></Info>
                </div>
                <Heatmap cells={data.heat.map((h: any) => ({ dow: h.dow, hr: h.hr, v: h.v }))} />
                {report?.peaktime && <div style={{ marginTop: 12 }}><AiBox>{report.peaktime}</AiBox></div>}
              </>
            )}
          </div>
        )}

        {tab === "lang" && (
          <div>
            <div className="hrow">
              <h3>언어권별 리뷰 비중 <span className="muted small">최근 30일</span></h3>
              <Info title="이 표는 어떻게 읽나요?">
                <p>{t.lang_note}</p>
                <p><b>도넛</b>은 최근 30일 동안 달린 모든 언어 리뷰 중 그 언어가 차지하는 비율이에요. 조각이나 표의 줄을 누르면 그 언어를 골라서 볼 수 있어요.</p>
                <p><b>긍정·부정 막대</b>는 그 언어 리뷰 안에서의 비율이고, <b>전체 대비</b>는 모든 언어 평균 긍정률과의 차이(%p)입니다.</p>
              </Info>
            </div>
            {langs.length === 0 ? <p className="muted">최근 30일 언어별 자료가 없습니다.</p> : (
              <>
                {report?.language && <AiBox>{report.language}</AiBox>}
                <div className="langwrap">
                  <div className="langdonut">
                    <Donut slices={slices} sel={selLang} onSel={setSelLang}
                      top={selL ? langName(selL.language) : "최근 30일"} bottom={selL ? `${selL.share ?? 0}% · ${num(selL.n)}건` : `${num(lTotal)}건`} />
                  </div>
                  <div className="langlist">
                    <div className="langrow head muted small"><span /><span>언어</span><span>비중</span><span>긍정·부정 (그 언어 리뷰 중)</span><span>전체 대비</span></div>
                    <div className="langrow total">
                      <span /><b>전체</b><span className="num">100%</span>
                      <div><PosNeg pos={lAll.pos} neg={lAll.neg} /><small className="muted">긍정 {num(lAll.pos)} · 부정 {num(lAll.neg)} (총 {num(lTotal)}건)</small></div>
                      <span className="num muted">{lAllRate != null ? `${lAllRate}%` : "-"}</span>
                    </div>
                    {langs.map((l, i) => (
                      <button key={l.language} className={`langrow${selLang === l.language ? " on" : ""}`} onClick={() => setSelLang(selLang === l.language ? null : l.language)}>
                        <i className="sw" style={{ background: i < 7 ? PALETTE[i] : OTHER_COLOR }} />
                        <b>{langName(l.language)}</b>
                        <span className="num">{l.share ?? "-"}%</span>
                        {l.n >= 30 ? <div><PosNeg pos={l.pos_n} neg={l.neg_n} /><small className="muted">긍정 {num(l.pos_n)} · 부정 {num(l.neg_n)} (총 {num(l.n)}건)</small></div> : <span className="muted small">표본 부족 (총 {num(l.n)}건)</span>}
                        <span className={`num ${trendClass(l.diff)}`}>{l.diff != null ? `${sign(l.diff, 1)}pp` : "-"}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {selL && (
                  <AiBox label={`${langName(selL.language)} 해설${selAi ? ` · ${selAi.month}` : ""}`}>
                    {selAi ? selAi.text : selL.n < 30 ? `${t.lang_small} (30건 미만)` : "이 언어는 숫자만 제공합니다."}
                  </AiBox>
                )}
                {!selL && <p className="muted small" style={{ marginTop: 8 }}>언어를 누르면 그 언어의 AI 해설이 나옵니다.</p>}
              </>
            )}
          </div>
        )}

        {tab === "active" && (
          <div>
            <div className="hrow">
              <h3>긍정 리뷰를 쓴 사람 중, 지금도 게임을 하는 사람 <span className="muted small">플레이타임 구간별</span></h3>
              <Info title="어떻게 계산하나요?">
                <p>긍정(추천) 리뷰를 쓴 사람마다 스팀이 알려 주는 <b>마지막 실행 시각</b>을 봅니다. 우리가 그 리뷰를 수집한 날 기준으로 <b>30일 안에 게임을 실행한 적이 있으면 '활성'</b>입니다.</p>
                <p>구간은 그 사람이 리뷰를 쓸 때까지 쌓은 플레이타임이에요. 예를 들어 "300시간 이상 49%"는, 300시간 넘게 하고 긍정 리뷰를 남긴 사람 100명 중 49명이 최근 30일 안에도 게임을 켰다는 뜻입니다. <b>평균 플레이타임이 아니에요.</b></p>
                <p>{t.active_help}</p>
                <p>주의: 리뷰를 오래전에 쓴 사람은 그만큼 시간이 지났기 때문에, 오래된 게임일수록 전체 숫자가 낮게 나오는 경향이 있어요. 같은 게임의 구간끼리, 또는 비슷한 시기에 나온 게임끼리 비교하세요.</p>
              </Info>
            </div>
            {Object.keys(m.active_bands ?? {}).length === 0 ? <p className="muted">마지막 접속 정보를 수집하는 중입니다. 플레이타임 보충이 끝나면 표시됩니다.</p> : (
              <div className="actwrap">
                <div className="colchart" role="img" aria-label="플레이타임 구간별 활성 리뷰어 비율">
                  <div className="plot">
                    {m.active_share != null && <div className="avgline" style={{ bottom: `${Math.round(m.active_share)}%` }}><span>전체 {Math.round(m.active_share)}%</span></div>}
                    {ACTIVE_BANDS.map(([k]) => { const b = m.active_bands[k]; const pct = b && b.n >= 20 ? Math.round((b.active / b.n) * 100) : null;
                      return <div key={k} className="track">{pct != null ? <><div className="fill" style={{ height: `${pct}%` }} /><span className="v num" style={{ bottom: `calc(${pct}% + 3px)` }}>{pct}%</span></> : <span className="v muted small" style={{ bottom: 4 }}>표본 부족</span>}</div>; })}
                  </div>
                  <div className="labels">
                    {ACTIVE_BANDS.map(([k, l]) => { const b = m.active_bands[k]; return <div key={k}><span>{l}</span><small className="muted">{b && b.n > 0 ? `${num(b.active)}/${num(b.n)}명` : "-"}</small></div>; })}
                  </div>
                </div>
                <div className="actside">
                  {m.active_share != null && <div className="big"><span className="num">{Math.round(m.active_share)}%</span><small className="muted">전체 구간 합계 · {num(m.active_n)}명 기준</small></div>}
                  {report?.lifecycle && <AiBox>{report.lifecycle}</AiBox>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <section id="sec-tl" className="tlsec">
        <div className="tlhead">
          <h2>타임라인</h2>
          <Info title="타임라인은 어떻게 읽나요?"><p>{t.tl_sub}</p><p>{t.impact_help}</p></Info>
          <div className="row" role="group" aria-label="타임라인 필터">
            {([["all", "전체"], ["official", "업데이트"], ["shift", "급변"], ["monthly", "월간 요약"]] as const).map(([k, l]) => (
              <button key={k} className="chip" aria-pressed={tl === k} onClick={() => setTl(k)}>{l} <span className="num">{cnt(k)}</span></button>
            ))}
          </div>
          <button className="chip sortb" onClick={() => setDesc(!desc)} aria-label="정렬 순서 바꾸기">{desc ? "최신순 ↓" : "오래된순 ↑"}</button>
        </div>
        <div className="tl">
          {items.length === 0 && <p className="muted">아직 표시할 항목이 없습니다. 분석이 끝나면 채워집니다.</p>}
          {items.map((x) => <TimelineCard key={x.key} x={x} flash={flash === x.key} />)}
        </div>
      </section>

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
      ["업데이트 언급", e.mention?.rate != null ? `${e.mention.rate}% (${e.mention.hit}건)` : "-"],
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
  const tone = x.type === "shift" ? shiftTone(x) : "";
  return (
    <div className="tl-item" id={`tl-${x.key}`}>
      <div className="tl-date"><b>{String(x.date).slice(0, 10)}</b>{typeLabel}</div>
      <div className={`tl-card ${x.type} ${tone}${flash ? " flash" : ""}`}>
        <h3>{x.url ? <a href={x.url} target="_blank" rel="noreferrer">{title}</a> : title}{impact && <Pill cls={impact[0]}>{impact[1]}</Pill>}</h3>
        <div className="facts">{facts.map(([k, v]) => <span key={k}><em>{k}</em> <b className="num">{v}</b></span>)}</div>
        {e.overlapping_events > 0 && <p className="muted small">같은 주에 다른 공지 {e.overlapping_events}건이 겹쳐 단독 효과는 분명하지 않을 수 있습니다.</p>}
        {x.reaction_summary ? <p className="tl-ai">{x.reaction_summary}</p> : <p className="muted small">AI 해설을 준비 중입니다.</p>}
        {x.type === "monthly" && e.update_summary && <p className="tl-ai" style={{ marginTop: 4 }}><b>업데이트:</b> {e.update_summary}</p>}
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
