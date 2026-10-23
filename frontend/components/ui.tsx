"use client";
import { useState } from "react";

export const PAL = [["#2a4b5a", "#7a9a8a"], ["#4a3a5c", "#a07a9a"], ["#3b4a2c", "#9aa86a"], ["#5a3a2a", "#c9946a"], ["#2a3b5a", "#6a8ac9"], ["#4a2a3a", "#c96a8a"]];

export function Pill({ cls = "plain", children, title, nodot }: { cls?: string; children: React.ReactNode; title?: string; nodot?: boolean }) {
  return <span className={`pill ${cls}${nodot ? " nodot" : ""}`} title={title}>{children}</span>;
}

/** Steam 대표 이미지. 불러오지 못하면 색 배경과 게임 이름으로 대신 보여 줍니다. */
export function Thumb({ appid, name, src, size }: { appid: number; name: string; src?: string | null; size?: "s" | "xl" }) {
  const [broken, setBroken] = useState(false);
  const p = PAL[appid % PAL.length];
  return (
    <span className={`th ${size ?? ""}`} style={{ ["--c1" as string]: p[0], ["--c2" as string]: p[1] }}>
      <i className="ph">{name}</i>
      {src && !broken && <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} />}
    </span>
  );
}

export function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="muted" style={{ fontSize: 11 }}>자료 부족</span>;
  const w = 100, h = 22, mn = Math.min(...values), mx = Math.max(...values), r = mx - mn || 1;
  const pts = values.map((x, i) => [(i * w) / (values.length - 1), h - 3 - ((x - mn) / r) * (h - 6)]);
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox="0 0 100 22" preserveAspectRatio="none" role="img" aria-label="최근 7일 동접 추세">
      <polyline points={pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ")} />
      <circle cx={last[0]} cy={last[1]} r="2.6" />
    </svg>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mh"><h2>{title}</h2><button className="btn small" onClick={onClose}>닫기</button></div>
        {children}
      </div>
    </div>
  );
}

export interface SteamHit { appid: number; name: string; meta: string; image: string | null }

/** Steam 상점 검색(이름·주소·AppID). 게임 추가와 추가 요청이 같이 씁니다. */
export function SteamSearch({ onPick, adminEndpoint }: { onPick: (h: SteamHit) => void; adminEndpoint?: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SteamHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function search() {
    if (q.trim().length < 2) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/steam-search?term=${encodeURIComponent(q.trim())}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "검색에 실패했습니다.");
      setHits(j.hits);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  void adminEndpoint;
  return (
    <div>
      <p className="muted" style={{ fontSize: 13 }}>게임 이름을 검색하거나, Steam 상점 주소 · AppID를 붙여 넣으세요.</p>
      <form className="row" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); search(); }}>
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: elden ring, 1245620" style={{ flex: 1, minWidth: 200 }} autoFocus />
        <button className="btn primary" disabled={busy}>{busy ? "검색 중…" : "검색"}</button>
      </form>
      {err && <p className="down" style={{ fontSize: 13, marginTop: 8 }}>{err}</p>}
      <div className="res">
        {hits?.map((h) => (
          <button key={h.appid} className="res-item" onClick={() => onPick(h)}>
            <Thumb appid={h.appid} name={h.name} src={h.image} size="s" />
            <div><div className="t">{h.name}</div><div className="m">{h.meta} · AppID {h.appid}</div></div>
          </button>
        ))}
        {hits && hits.length === 0 && <p className="muted">검색 결과가 없습니다. Steam 상점 주소나 AppID를 붙여 넣어 보세요.</p>}
      </div>
    </div>
  );
}
