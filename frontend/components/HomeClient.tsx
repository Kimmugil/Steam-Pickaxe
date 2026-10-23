"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Modal, Pill, Spark, SteamSearch, Thumb, type SteamHit } from "./ui";
import { sign, trendClass } from "@/lib/format";
import type { Texts } from "@/lib/text-defs";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Card = { appid: number; name: string; thumbnail: string | null; status: string; diag: string | null; pos30: number | null; velocityChange: number | null; velocity: number | null; one: string; spark: number[]; isNew: boolean; attention: number };
const DIAGS = ["healthy", "quiet", "angry", "cool"] as const;
const CLS: Record<string, string> = { healthy: "good", quiet: "warn", angry: "bad", cool: "cool" };

export default function HomeClient({ texts: t, data }: { texts: Texts; data: any }) {
  const cards: Card[] = data.cards;
  const [diag, setDiag] = useState<string>("all");
  const [sort, setSort] = useState<"attn" | "pos" | "vel">("attn");
  const [tab, setTab] = useState<"w4" | "m">("w4");
  const [deskOpen, setDeskOpen] = useState(false);
  const [mobOpen, setMobOpen] = useState(false);
  const [wide, setWide] = useState(true);
  const [reqOpen, setReqOpen] = useState(false);
  const [intro, setIntro] = useState(false);

  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 1100);
    on(); window.addEventListener("resize", on);
    try { if (!localStorage.getItem("sp_seen_intro")) setIntro(true); } catch { /* 저장소를 못 써도 무방 */ }
    return () => window.removeEventListener("resize", on);
  }, []);

  const label = (k: string) => t[`diag_${k}_name`];
  const help = (k: string) => t[`diag_${k}_help`];
  const counts: Record<string, number> = { all: cards.length };
  for (const k of DIAGS) counts[k] = cards.filter((c) => c.diag === k).length;
  const list = cards.filter((c) => diag === "all" || c.diag === diag).sort((a, b) =>
    sort === "pos" ? (b.pos30 ?? -1) - (a.pos30 ?? -1) : sort === "vel" ? (b.velocity ?? -1) - (a.velocity ?? -1) : b.attention - a.attention);
  const brief = tab === "w4" ? data.w4 : data.month;
  const panelOpen = wide ? deskOpen : mobOpen;
  const byId = new Map(cards.map((c) => [c.appid, c]));

  return (
    <>
      {data.error && <div className="notice">데이터를 불러오지 못했습니다. 관리자라면 /api/health 에서 데이터베이스 연결 상태를 확인해 주세요.</div>}
      <div className={`home-grid${wide && deskOpen ? " with-brief" : ""}`}>
        <div>
          <div className="sec-title" style={{ marginTop: 0 }}><h2>{t.hl_title}</h2><span>{t.hl_sub}</span></div>
          <div className="highlights">
            {data.highlights.length === 0 && <p className="muted">이번 주에는 크게 움직인 게임이 없습니다.</p>}
            {data.highlights.map((h: any) => (
              <Link key={h.appid} href={`/game/${h.appid}`} className="hl">
                <Thumb appid={h.appid} name={h.name} src={byId.get(h.appid)?.thumbnail} size="s" />
                <div>
                  <div>{h.tags?.[0] && <Pill cls={h.tags[0][0]}>{h.tags[0][1]}</Pill>}</div>
                  <div className="t">{h.name}</div><div className="d">{h.text}</div>
                </div>
              </Link>
            ))}
          </div>

          <div className="sec-title"><h2>{t.games_title}</h2><span>{list.length}개 표시</span></div>
          <div className="toolbar">
            <div className="row" role="group" aria-label="진단별 보기">
              <button className="chip" aria-pressed={diag === "all"} onClick={() => setDiag("all")}>전체 {counts.all}</button>
              {DIAGS.map((k) => <button key={k} className="chip" aria-pressed={diag === k} onClick={() => setDiag(k)}>{label(k)} {counts[k]}</button>)}
            </div>
            <button className="btn small ghost" onClick={() => setReqOpen(true)}>게임 추가 요청</button>
            <label className="sp muted">정렬{" "}
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                <option value="attn">주목도순</option><option value="pos">최근 30일 긍정률순</option><option value="vel">리뷰 속도순</option>
              </select>
            </label>
          </div>
          <div className="gcards">
            {list.length === 0 && <div className="empty" style={{ gridColumn: "1/-1" }}>{t.empty_games}</div>}
            {list.map((g) => (
              <Link key={g.appid} href={`/game/${g.appid}`} className="gcard">
                <div className="img">
                  <Thumb appid={g.appid} name={g.name} src={g.thumbnail} />
                  {g.diag ? <Pill cls={CLS[g.diag]} title={help(g.diag)}>{label(g.diag)}</Pill> : <Pill cls="plain">{g.status === "collecting" ? "수집 중" : "분석 대기"}</Pill>}
                  {g.isNew && <span className="newb">NEW</span>}
                </div>
                <div className="body">
                  <div className="nm">{g.name}</div>
                  <div className="one">{g.one}</div>
                  <div className="nums">
                    <span>긍정률<b>{g.pos30 === null ? "-" : `${Math.round(g.pos30)}%`}</b></span>
                    <span>리뷰<b className={trendClass(g.velocityChange)}>{g.velocityChange === null ? "-" : `${sign(g.velocityChange)}%`}</b></span>
                    <span className="sp2"><Spark values={g.spark} /></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <aside className={`brief${!wide && mobOpen ? " open" : ""}`} style={wide && !deskOpen ? { display: "none" } : undefined} aria-label="브리핑 패널">
          <header>
            <h2>{t.brief_title}</h2>
            <button className="btn small" onClick={() => (wide ? setDeskOpen(false) : setMobOpen(false))}>접기</button>
          </header>
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={tab === "w4"} onClick={() => setTab("w4")}>{t.brief_tab_w4}</button>
            <button role="tab" aria-selected={tab === "m"} onClick={() => setTab("m")}>{t.brief_tab_m}</button>
          </div>
          {!brief ? <p className="muted" style={{ marginTop: 12 }}>아직 만들어진 {tab === "w4" ? "브리핑" : "월간 리포트"}가 없습니다.</p> : (
            <>
              <div className="upd" style={{ marginTop: 10 }}>
                {tab === "w4" ? `${brief.asof} 기준 · 대상 기간 ${brief.period_start} ~ ${brief.period_end}` : `${brief.month} 월간 리포트`}
              </div>
              <div className="cnt">특이사항이 있는 게임 <b>{brief.items.length}개</b> <span className="muted">· 추적 중 {brief.tracked}개 중</span></div>
              {brief.items.length === 0 ? <p className="muted">이 기간에는 특이사항이 있는 게임이 없습니다.</p> : (
                <ul>
                  {brief.items.map((i: any) => (
                    <li key={i.appid}>
                      <Thumb appid={i.appid} name={i.name} src={i.thumbnail} size="s" />
                      <div className="bx">
                        <b><Link href={`/game/${i.appid}`}>{i.name}</Link>{i.nw && <> <span className="newb">NEW</span></>}</b>
                        <span>{i.text}</span>
                        <span className="tags">{i.tags.map((tg: string[], k: number) => <Pill key={k} cls={tg[0]}>{tg[1]}</Pill>)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </aside>
      </div>

      {!panelOpen && <button className="brief-fab" onClick={() => (wide ? setDeskOpen(true) : setMobOpen(true))}>{t.brief_title} 열기</button>}
      {reqOpen && <RequestModal onClose={() => setReqOpen(false)} />}
      {intro && (
        <Modal title={t.first_title} onClose={() => { try { localStorage.setItem("sp_seen_intro", "1"); } catch { /* 무시 */ } setIntro(false); }}>
          <p>{t.first_body}</p>
        </Modal>
      )}
    </>
  );
}

function RequestModal({ onClose }: { onClose: () => void }) {
  const [sel, setSel] = useState<SteamHit | null>(null);
  const [memo, setMemo] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!sel) return;
    setBusy(true);
    const r = await fetch("/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appid: sel.appid, name: sel.name, meta: sel.meta, memo }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? j.message ?? "요청을 보냈습니다." : j.error ?? "요청을 보내지 못했습니다.");
  }
  return (
    <Modal title="게임 추가 요청" onClose={onClose}>
      {msg ? <><p>{msg}</p><div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}><button className="btn primary" onClick={onClose}>닫기</button></div></> :
        !sel ? <SteamSearch onPick={setSel} /> : (
          <>
            <div className="res-item" style={{ cursor: "default" }}><Thumb appid={sel.appid} name={sel.name} src={sel.image} size="s" /><div><div className="t">{sel.name}</div><div className="m">{sel.meta} · AppID {sel.appid}</div></div></div>
            <div className="opt"><label htmlFor="reqMemo"><b>관리자에게 한마디 (선택)</b></label><textarea id="reqMemo" rows={2} maxLength={200} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 신작이라 꾸준히 보고 싶어요" /></div>
            <p className="muted" style={{ fontSize: 12.5 }}>보내는 즉시 처리되지 않고, 관리자가 확인한 뒤 추가합니다. 같은 게임을 여러 명이 요청하면 한 줄로 합쳐지고 요청 횟수가 늘어납니다.</p>
            <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}><button className="btn" onClick={() => setSel(null)}>뒤로</button><button className="btn primary" disabled={busy} onClick={send}>{busy ? "보내는 중…" : "요청 보내기"}</button></div>
          </>
        )}
    </Modal>
  );
}
