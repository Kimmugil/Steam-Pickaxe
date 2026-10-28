"use client";
import { useRef, useState } from "react";

/** tone: 급락은 빨강, 회복(급등)은 초록으로 구분해서 그립니다 */
export interface Mark { i: number; label: string; onClick: () => void; tone?: "good" | "bad" }

interface LineOpts {
  vals: (number | null)[]; min: number; max: number; ticks: number[]; unit?: string; xl: [number, string][]; label: string;
  marks?: Mark[]; area?: boolean;
  /** 점마다 마우스를 올렸을 때 보여 줄 설명 (vals 와 같은 길이) */
  pts?: string[];
}

/** 마우스를 올리면 그 위치의 시점·값을 말풍선으로 보여 주는 래퍼. 자식 SVG 의 가로 위치(0~1)를 점 번호로 바꿉니다. */
function useHover(n: number, w: number, left: number, right: number) {
  const [hi, setHi] = useState<number | null>(null);
  const [tip, setTip] = useState<{ x: number; text: string } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const idxAt = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !r.width) return null;
    const vx = ((clientX - r.left) / r.width) * w;                       // SVG 좌표로 환산
    return Math.max(0, Math.min(n - 1, Math.round(((vx - left) / (w - left - right)) * (n - 1))));
  };
  return { box, hi, tip, setHi, setTip, idxAt };
}

/** 선 차트 (SVG). 값이 없는 구간은 선이 끊깁니다. 마우스를 올리면 시점과 값이 뜨고, 붉은 표시는 눌러서 해당 카드로 이동합니다. */
export function LineChart({ vals, min, max, ticks, unit = "", xl, label, marks = [], area, pts }: LineOpts) {
  const w = 680, h = 200, m = { l: 40, r: 10, t: 10, b: 24 }, iw = w - m.l - m.r, ih = h - m.t - m.b;
  const n = vals.length;
  const H = useHover(n, w, m.l, m.r);
  if (n < 2) return <p className="muted">표시할 자료가 아직 없습니다.</p>;
  const X = (i: number) => m.l + (iw * i) / (n - 1);
  const Y = (v: number) => m.t + ih * (1 - (v - min) / (max - min));
  const segs: string[][] = [[]];
  vals.forEach((v, i) => { if (v === null) { if (segs[segs.length - 1].length) segs.push([]); } else segs[segs.length - 1].push(`${X(i).toFixed(1)},${Y(v).toFixed(1)}`); });
  const hv = H.hi != null ? vals[H.hi] : null;
  return (
    <div className="chartbox" ref={H.box}
      onMouseMove={(e) => { const i = H.idxAt(e.clientX); if (i == null) return; H.setHi(i); H.setTip({ x: (X(i) / w) * 100, text: pts?.[i] ?? `${vals[i] ?? "-"}${unit}` }); }}
      onMouseLeave={() => { H.setHi(null); H.setTip(null); }}>
      <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
        {ticks.map((t) => (<g key={t}><line className="grid" x1={m.l} x2={w - m.r} y1={Y(t)} y2={Y(t)} /><text x={m.l - 6} y={Y(t) + 3} textAnchor="end">{t}{unit}</text></g>))}
        {xl.map(([i, t]) => (<text key={i} x={X(i)} y={h - 6} textAnchor="middle">{t}</text>))}
        {segs.filter((s) => s.length > 1).map((s, k) => (
          <g key={k}>
            {area && <polygon className="area" points={`${s[0].split(",")[0]},${m.t + ih} ${s.join(" ")} ${s[s.length - 1].split(",")[0]},${m.t + ih}`} />}
            <polyline className="l1" points={s.join(" ")} />
          </g>
        ))}
        {H.hi != null && <line className="guide" x1={X(H.hi)} x2={X(H.hi)} y1={m.t} y2={m.t + ih} />}
        {H.hi != null && hv !== null && <circle className="hot" cx={X(H.hi)} cy={Y(hv)} r="4" />}
        {marks.map((mk) => vals[mk.i] !== null && (
          <g key={mk.i} className="markg" onClick={mk.onClick} role="button" tabIndex={0} aria-label={mk.label}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") mk.onClick(); }}
            onMouseEnter={() => { H.setHi(mk.i); H.setTip({ x: (X(mk.i) / w) * 100, text: mk.label }); }}>
            <circle className="mhit" cx={X(mk.i)} cy={Y(vals[mk.i] as number)} r="11" />
            <circle className={`mark ${mk.tone ?? "bad"}`} cx={X(mk.i)} cy={Y(vals[mk.i] as number)} r="5" />
          </g>
        ))}
      </svg>
      {H.tip && <div className="tip" style={{ left: `${Math.min(88, Math.max(12, H.tip.x))}%` }}>{H.tip.text}</div>}
    </div>
  );
}

/** 막대(오른쪽 축)와 선(왼쪽 축)을 한 그래프에 겹친 차트. 두 지표가 같은 시기에 같이 움직였는지 보려는 용도입니다. */
export function ComboChart({ line, bars, lineMin, lineMax, lineTicks, barMax, xl, label, marks = [], pts }: {
  line: (number | null)[]; bars: number[]; lineMin: number; lineMax: number; lineTicks: number[]; barMax: number;
  xl: [number, string][]; label: string; marks?: Mark[]; pts?: string[];
}) {
  const w = 680, h = 240, m = { l: 40, r: 44, t: 10, b: 24 }, iw = w - m.l - m.r, ih = h - m.t - m.b;
  const n = line.length;
  const H = useHover(n, w, m.l, m.r);
  if (n < 2) return <p className="muted">표시할 자료가 아직 없습니다.</p>;
  const X = (i: number) => m.l + (iw * i) / (n - 1);
  const YL = (v: number) => m.t + ih * (1 - (v - lineMin) / (lineMax - lineMin));
  const YB = (v: number) => m.t + ih * (1 - v / barMax);
  const bw = Math.max(1, iw / n - 1);
  const segs: string[][] = [[]];
  line.forEach((v, i) => { if (v === null) { if (segs[segs.length - 1].length) segs.push([]); } else segs[segs.length - 1].push(`${X(i).toFixed(1)},${YL(v).toFixed(1)}`); });
  const hv = H.hi != null ? line[H.hi] : null;
  return (
    <div className="chartbox" ref={H.box}
      onMouseMove={(e) => { const i = H.idxAt(e.clientX); if (i == null) return; H.setHi(i); H.setTip({ x: (X(i) / w) * 100, text: pts?.[i] ?? `${line[i] ?? "-"}` }); }}
      onMouseLeave={() => { H.setHi(null); H.setTip(null); }}>
      <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
        {lineTicks.map((t) => (<g key={t}><line className="grid" x1={m.l} x2={w - m.r} y1={YL(t)} y2={YL(t)} /><text x={m.l - 6} y={YL(t) + 3} textAnchor="end">{t}%</text></g>))}
        {[0, barMax / 2, barMax].map((t) => (<text key={t} className="rt" x={w - m.r + 6} y={YB(t) + 3} textAnchor="start">{Math.round(t)}</text>))}
        {xl.map(([i, t]) => (<text key={i} x={X(i)} y={h - 6} textAnchor="middle">{t}</text>))}
        {bars.map((v, i) => <rect key={i} className={`cbar${H.hi === i ? " on" : ""}`} x={X(i) - bw / 2} y={YB(v)} width={bw} height={Math.max(0, m.t + ih - YB(v))} />)}
        {segs.filter((s) => s.length > 1).map((s, k) => <polyline key={k} className="l1" points={s.join(" ")} />)}
        {H.hi != null && <line className="guide" x1={X(H.hi)} x2={X(H.hi)} y1={m.t} y2={m.t + ih} />}
        {H.hi != null && hv !== null && <circle className="hot" cx={X(H.hi)} cy={YL(hv)} r="4" />}
        {marks.map((mk) => line[mk.i] !== null && (
          <g key={mk.i} className="markg" onClick={mk.onClick} role="button" tabIndex={0} aria-label={mk.label}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") mk.onClick(); }}
            onMouseEnter={() => { H.setHi(mk.i); H.setTip({ x: (X(mk.i) / w) * 100, text: mk.label }); }}>
            <circle className="mhit" cx={X(mk.i)} cy={YL(line[mk.i] as number)} r="11" />
            <circle className={`mark ${mk.tone ?? "bad"}`} cx={X(mk.i)} cy={YL(line[mk.i] as number)} r="5" />
          </g>
        ))}
      </svg>
      {H.tip && <div className="tip" style={{ left: `${Math.min(88, Math.max(12, H.tip.x))}%` }}>{H.tip.text}</div>}
    </div>
  );
}

export interface Slice { key: string; label: string; value: number; color: string }

/** 도넛 차트: 전체에서 각 조각이 차지하는 비중을 보여 줍니다. 조각을 누르면 선택됩니다. */
export function Donut({ slices, sel, onSel, top, bottom }: { slices: Slice[]; sel: string | null; onSel: (k: string | null) => void; top: string; bottom: string }) {
  const R = 62, C = 2 * Math.PI * R, tot = slices.reduce((a, s) => a + s.value, 0) || 1;
  let acc = 0;
  return (
    <svg className="donut" viewBox="0 0 180 180" role="img" aria-label="언어별 리뷰 비중">
      <circle cx="90" cy="90" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="26" />
      {slices.map((s) => {
        const len = Math.max(0, (C * s.value) / tot - 1.5), off = -acc;
        acc += (C * s.value) / tot;
        return (
          <circle key={s.key} cx="90" cy="90" r={R} fill="none" stroke={s.color} strokeWidth={sel === s.key ? 32 : 26}
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={off} transform="rotate(-90 90 90)"
            opacity={sel && sel !== s.key ? 0.4 : 1} style={{ cursor: "pointer", transition: "opacity .15s" }}
            onClick={() => onSel(sel === s.key ? null : s.key)}><title>{`${s.label} ${((100 * s.value) / tot).toFixed(1)}%`}</title></circle>
        );
      })}
      <text x="90" y="86" textAnchor="middle" className="dt1">{top}</text>
      <text x="90" y="104" textAnchor="middle" className="dt2">{bottom}</text>
    </svg>
  );
}

export function BarChart({ vals, label, pts }: { vals: number[]; label: string; pts?: string[] }) {
  const w = 680, h = 90, m = { l: 40, r: 10, t: 6, b: 6 }, iw = w - m.l - m.r, ih = h - m.t - m.b;
  const mx = Math.max(1, ...vals), bw = iw / Math.max(1, vals.length);
  const [hi, setHi] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const at = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !r.width) return null;
    const vx = ((clientX - r.left) / r.width) * w;
    const i = Math.floor((vx - m.l) / bw);
    return i >= 0 && i < vals.length ? i : null;
  };
  return (
    <div className="chartbox" ref={box} onMouseMove={(e) => setHi(at(e.clientX))} onMouseLeave={() => setHi(null)}>
      <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
        <text x={m.l - 6} y={m.t + 8} textAnchor="end">{Math.round(mx)}</text>
        <text x={m.l - 6} y={h - m.b} textAnchor="end">0</text>
        {vals.map((v, i) => { const bh = (ih * v) / mx; return <rect key={i} className={`bar${hi === i ? " on" : ""}`} x={m.l + i * bw + 1} y={m.t + ih - bh} width={Math.max(1, bw - 2)} height={bh} />; })}
      </svg>
      {hi != null && <div className="tip" style={{ left: `${Math.min(88, Math.max(12, ((m.l + (hi + 0.5) * bw) / w) * 100))}%` }}>{pts?.[hi] ?? `${vals[hi]}`}</div>}
    </div>
  );
}

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
export function Heatmap({ cells }: { cells: { dow: number; hr: number; v: number }[] }) {
  const mx = Math.max(1, ...cells.map((c) => c.v));
  const by = new Map(cells.map((c) => [`${c.dow}-${c.hr}`, c.v]));
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="heat">
      <span />
      {Array.from({ length: 24 }, (_, h) => (<span key={h} className="h">{h % 3 === 0 ? h : ""}</span>))}
      {order.map((d) => (
        <span key={d} style={{ display: "contents" }}>
          <span className="d">{DOW[d]}</span>
          {Array.from({ length: 24 }, (_, h) => {
            const v = by.get(`${d}-${h}`) ?? 0;
            return <span key={h} className="c" title={`${DOW[d]} ${h}시 평균 ${Math.round(v).toLocaleString()}명`} style={{ ["--v" as string]: (0.06 + (v / mx) * 0.94).toFixed(2) }} />;
          })}
        </span>
      ))}
    </div>
  );
}

/** 4분면 진단 위치 (가로: 활동, 세로: 평가) */
export function Quadrant({ diag }: { diag: string | null }) {
  const pos: Record<string, [number, number]> = { quiet: [62, 42], healthy: [150, 42], cool: [62, 118], angry: [150, 118] };
  const p = diag ? pos[diag] : null;
  return (
    <svg className="quad" viewBox="0 0 220 190" role="img" aria-label="평가와 활동 2축 진단 위치" style={{ marginTop: 10 }}>
      <rect className="bg" x="30" y="6" width="184" height="150" rx="6" />
      <line x1="122" y1="6" x2="122" y2="156" /><line x1="30" y1="81" x2="214" y2="81" />
      <text className="ql" x="36" y="20">조용한 이탈</text><text className="ql" x="128" y="20">건강</text>
      <text className="ql" x="36" y="150">침체</text><text className="ql" x="128" y="150">불만</text>
      {p && <circle className="qd" cx={p[0]} cy={p[1]} r="8" />}
      <text className="ql" x="30" y="176">← 활동 감소</text><text className="ql" x="160" y="176">활동 활발 →</text>
      <text className="ql" transform="translate(12 120) rotate(-90)">평가 낮음 ↔ 높음</text>
    </svg>
  );
}

/** 긍정·부정 막대 한 줄 (막대 전체가 100%) */
export function PosNeg({ pos, neg }: { pos: number; neg: number }) {
  const t = pos + neg;
  const p = t ? (100 * pos) / t : null;
  return <div className="pn" aria-label={p != null ? `긍정 ${p.toFixed(0)}%` : "자료 없음"}>{p != null ? <><i className="g" style={{ width: `${p}%` }} /><i className="r" style={{ width: `${100 - p}%` }} /><em className="num">{p.toFixed(0)}%</em></> : <span className="muted">-</span>}</div>;
}
