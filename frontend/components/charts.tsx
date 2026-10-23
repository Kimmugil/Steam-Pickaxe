"use client";

interface LineOpts {
  vals: (number | null)[]; min: number; max: number; ticks: number[]; unit?: string; xl: [number, string][]; label: string;
  marks?: number[]; area?: boolean;
}

/** 단순한 선 차트 (SVG). 값이 없는 구간은 선이 끊깁니다. */
export function LineChart({ vals, min, max, ticks, unit = "", xl, label, marks = [], area }: LineOpts) {
  const w = 680, h = 200, m = { l: 40, r: 10, t: 10, b: 24 }, iw = w - m.l - m.r, ih = h - m.t - m.b;
  const n = vals.length;
  if (n < 2) return <p className="muted">표시할 자료가 아직 없습니다.</p>;
  const X = (i: number) => m.l + (iw * i) / (n - 1);
  const Y = (v: number) => m.t + ih * (1 - (v - min) / (max - min));
  const segs: string[][] = [[]];
  vals.forEach((v, i) => { if (v === null) { if (segs[segs.length - 1].length) segs.push([]); } else segs[segs.length - 1].push(`${X(i).toFixed(1)},${Y(v).toFixed(1)}`); });
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      {ticks.map((t) => (<g key={t}><line className="grid" x1={m.l} x2={w - m.r} y1={Y(t)} y2={Y(t)} /><text x={m.l - 6} y={Y(t) + 3} textAnchor="end">{t}{unit}</text></g>))}
      {xl.map(([i, t]) => (<text key={i} x={X(i)} y={h - 6} textAnchor="middle">{t}</text>))}
      {segs.filter((s) => s.length > 1).map((s, k) => (
        <g key={k}>
          {area && <polygon className="area" points={`${s[0].split(",")[0]},${m.t + ih} ${s.join(" ")} ${s[s.length - 1].split(",")[0]},${m.t + ih}`} />}
          <polyline className="l1" points={s.join(" ")} />
        </g>
      ))}
      {marks.map((i) => vals[i] !== null && <circle key={i} className="mark" cx={X(i)} cy={Y(vals[i] as number)} r="4.5" />)}
    </svg>
  );
}

export function BarChart({ vals, label }: { vals: number[]; label: string }) {
  const w = 680, h = 90, m = { l: 40, r: 10, t: 6, b: 6 }, iw = w - m.l - m.r, ih = h - m.t - m.b;
  const mx = Math.max(1, ...vals), bw = iw / Math.max(1, vals.length);
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <text x={m.l - 6} y={m.t + 8} textAnchor="end">{Math.round(mx)}</text>
      <text x={m.l - 6} y={h - m.b} textAnchor="end">0</text>
      {vals.map((v, i) => { const bh = (ih * v) / mx; return <rect key={i} className="bar" x={m.l + i * bw + 1} y={m.t + ih - bh} width={Math.max(1, bw - 2)} height={bh} />; })}
    </svg>
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
