"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pill, SteamSearch, Thumb, type SteamHit } from "./ui";
import { ago, kst, num, TIER_LABEL, TIER_RULE } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Dot = "good" | "warn" | "bad" | "na";
const CHIPS = ["구간 분석", "게임 리포트", "언어별", "급변 감지", "업데이트 영향"];
const JOB_LABEL: Record<string, string> = { collect: "리뷰 수집", ccu: "동접 수집", analyze: "AI 분석", calc: "지표 계산", brief: "브리핑", add_game: "게임 추가", probe: "수집 점검" };
const JOB_EVERY: Record<string, number> = { collect: 36, ccu: 4, analyze: 36, calc: 36, brief: 24 * 8 }; // 이 시간(시간) 넘게 기록이 없으면 이상 신호

async function call(url: string, body: unknown, method = "POST") {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && j.ok !== false, message: j.message ?? j.error ?? (r.ok ? "완료했습니다." : "실패했습니다.") };
}

export default function AdminClient({ data, githubConnected }: { data: any; githubConnected: boolean }) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [evOpen, setEvOpen] = useState<number | null | "pick">(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [csvGame, setCsvGame] = useState("");
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 4500); return () => clearTimeout(id); }, [toast]);
  const say = async (p: Promise<{ ok: boolean; message: string }>, refresh = true) => { const r = await p; setToast(r.message); if (refresh) router.refresh(); return r; };

  const now = Date.now();
  const prevMonth = new Date(now - 31 * 86400000).toISOString().slice(0, 7);
  const failedBy = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const f of data.failed) { const k = `${f.appid}:${f.kind}`; m.set(k, [...(m.get(k) ?? []), f]); }
    return m;
  }, [data.failed]);

  const rows = data.games.map((g: any) => {
    const m = g.metrics ?? {};
    const ready = !!m.data_ready;
    const fk = (kind: string) => (failedBy.get(`${g.appid}:${kind}`) ?? []).some((f: any) => f.attempts >= 3);
    const reportAge = g.report_at ? (now - new Date(g.report_at).getTime()) / 86400000 : null;
    const chips: Dot[] = [
      fk("monthly") ? "bad" : !ready ? "na" : g.last_monthly && g.last_monthly >= prevMonth ? "good" : "warn",
      fk("report") ? "bad" : !ready ? "na" : reportAge !== null && reportAge <= 10 ? "good" : "warn",
      fk("monthly") ? "bad" : !ready ? "na" : g.lang_recent > 0 ? "good" : "warn",
      fk("shift_explain") ? "bad" : !ready ? "na" : g.shifts_open === 0 ? "good" : "warn",
      fk("impact_explain") ? "bad" : !ready ? "na" : g.impacts_open === 0 ? "good" : "warn",
    ];
    const pct = g.steam_total_reviews ? Math.min(100, Math.round((g.reviews_collected / g.steam_total_reviews) * 100)) : 100;
    const pt = g.reviews_collected ? Math.round((g.reviews_with_playtime / g.reviews_collected) * 100) : 0;
    const ccuMissing = !g.ccu_history_imported && (!g.ccu_start || (g.first_review && new Date(g.ccu_start).getTime() - new Date(g.first_review).getTime() > 14 * 86400000));
    const archived = g.status === "archived";
    const tier = g.tier_override ?? g.tier;
    const interval = tier === "hot" ? 1 : tier === "mid" ? 3 : tier === "calm" ? 10 : 30;
    const overdue = !archived && g.last_collected_at && now - new Date(g.last_collected_at).getTime() > interval * 2 * 86400000 + 86400000;
    let state: "good" | "warn" | "bad" = "good", note = "";
    if (chips.includes("bad")) { state = "bad"; note = "분석 실패"; }
    else if (g.review_cursor) { state = "warn"; note = "과거 리뷰 보충 중"; }
    else if (g.status === "collecting") { state = "warn"; note = "초기 수집 중"; }
    else if (!archived && !ready) { state = "warn"; note = "최신 리뷰 수집 대기"; }
    else if (!archived && ready && !m.diagnosis) { state = "warn"; note = "진단 없음 (최근 90일 리뷰가 적거나 집계 이상)"; }
    else if (overdue) { state = "warn"; note = "수집이 늦어짐"; }
    else if (!archived && (chips.includes("warn") || ccuMissing)) { state = "warn"; note = ccuMissing ? "동접 과거 데이터 없음" : "분석 대기"; }
    return { g, chips, pct, pt, ccuMissing, archived, tier, state, note, ready };
  });
  const live = rows.filter((r: any) => !r.archived);
  const cnt = { good: live.filter((r: any) => r.state === "good").length, warn: live.filter((r: any) => r.state === "warn").length, bad: live.filter((r: any) => r.state === "bad").length };
  const missing = live.filter((r: any) => r.ccuMissing);
  const jobs: any[] = data.jobs;
  const staleJobs = Object.keys(JOB_EVERY).filter((j) => {
    const r = jobs.find((x) => x.job === j);
    return !r || (now - new Date(r.started_at).getTime()) / 3600000 > JOB_EVERY[j];
  });
  const lastOk = jobs.filter((j) => j.ok).sort((a, b) => +new Date(b.finished_at) - +new Date(a.finished_at))[0];

  async function uploadCsv(file: File) {
    if (!csvGame) { setToast("먼저 게임을 선택해 주세요."); return; }
    const f = new FormData(); f.append("appid", csvGame); f.append("file", file);
    const r = await fetch("/api/admin/ccu-upload", { method: "POST", body: f });
    const j = await r.json().catch(() => ({}));
    setToast(j.message ?? j.error ?? "업로드에 실패했습니다.");
    if (csvRef.current) csvRef.current.value = "";
    router.refresh();
  }

  return (
    <div>
      <div className="sec-title" style={{ marginTop: 0 }}>
        <h2>관리자 현황판</h2>
        <span>마지막 시스템 점검: {lastOk ? `${kst(lastOk.finished_at)} (${JOB_LABEL[lastOk.job] ?? lastOk.job})` : "기록 없음"}</span>
        <button className="btn small" style={{ marginLeft: "auto" }} onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); router.replace("/"); router.refresh(); }}>로그아웃</button>
      </div>

      <div className="tiles">
        <div className="tile"><div className="k">정상</div><div className="v" style={{ color: "var(--good)" }}>{cnt.good}<span className="muted" style={{ fontSize: 14 }}> / {live.length}</span></div><div className="s">추적 중인 게임 기준 (보관 제외)</div></div>
        <div className="tile"><div className="k">확인 필요</div><div className="v" style={{ color: "var(--warn)" }}>{cnt.warn}</div><div className="s">진행 중이거나 안내가 필요한 항목</div></div>
        <div className="tile"><div className="k">오류</div><div className="v" style={{ color: "var(--bad)" }}>{cnt.bad}</div><div className="s">자동 재시도 3회 후 멈춘 항목</div></div>
        <div className="tile"><div className="k">데이터베이스 사용량</div><div className="v">{(data.dbBytes / 1073741824).toFixed(2)}<span className="muted" style={{ fontSize: 14 }}> / 8 GB</span></div>
          <div className="meter"><i style={{ width: `${Math.min(100, (data.dbBytes / 8589934592) * 100)}%` }} /></div>
          <div className="s">Gemini 호출 이번 달 <b className="num">{data.usage.calls}</b> / {data.cap}</div></div>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn primary" onClick={() => say(call("/api/admin/dispatch", { workflow: "analyze-daily.yml" }), false)}>지금 점검·복구</button>
        <button className="btn" onClick={() => setAddOpen(true)}>게임 추가·보관</button>
        <button className="btn" onClick={() => setEvOpen("pick")}>이벤트 수동 등록</button>
        <Link className="btn" href="/admin/texts">화면 문구 관리</Link>
      </div>
      {!githubConnected && <p className="help">"지금 점검·복구"는 GitHub 자동 실행이 연결되면 동작합니다. 연결 전에는 정기 실행(또는 컴퓨터에서 수동 실행) 때 점검·복구가 진행됩니다.</p>}

      <div className="sec-title"><h2>해야 할 일</h2><span>자동으로 해결되지 않아 사람이 확인해야 하는 것만 모았습니다</span></div>
      <div className="todo">
        {staleJobs.length > 0 && (
          <div className="todo-item"><div className="head"><div className="tx"><b>자동 작업이 오래 멈춰 있습니다: {staleJobs.map((j) => JOB_LABEL[j] ?? j).join(", ")}</b>
            <span>정해진 시간 안에 실행 기록이 없습니다. 자동 실행(GitHub)이 아직 연결되지 않았거나 중단되었을 수 있습니다.</span></div><Pill cls="bad">점검 필요</Pill></div>
            <div className="fix"><b>이렇게 하세요</b> GitHub 저장소의 Actions 탭에서 최근 실행과 오류 메시지를 확인하세요. 처음 설정 중이라면 연결을 끝낸 뒤 사라집니다.</div></div>
        )}
        {data.failed.filter((f: any) => f.attempts >= 3).map((f: any) => (
          <div key={`${f.appid}-${f.kind}-${f.period_key}-${f.scope}`} className="todo-item">
            <div className="head"><div className="tx"><b>{f.name}: {f.kind} {f.period_key} {f.scope !== "all" ? f.scope : ""} 분석 실패</b><span>{f.last_error ?? "오류 내용 없음"} · {ago(f.updated_at)}</span></div><Pill cls="bad">오류</Pill></div>
            <div className="fix"><b>이렇게 하세요</b> 먼저 [다시 시도]를 누르세요. 그래도 실패하면 [건너뛰기]를 눌러도 홈과 상세 화면은 이전 결과로 계속 보입니다.</div>
            <div className="row">
              <button className="btn small primary" onClick={() => say(call("/api/admin/tasks", { ...f, action: "reset" }))}>다시 시도</button>
              <button className="btn small" onClick={() => say(call("/api/admin/tasks", { ...f, action: "skip" }))}>건너뛰기</button>
            </div>
          </div>
        ))}
        {data.requests.map((r: any) => (
          <div key={r.appid} className="todo-item">
            <div className="head"><Thumb appid={r.appid} name={r.name} src={`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${r.appid}/header.jpg`} size="s" />
              <div className="tx"><b>게임 추가 요청: {r.name}</b><span>{r.meta ? `${r.meta} · ` : ""}요청 {r.request_count}건{r.memo ? ` · "${r.memo}"` : ""}</span></div><Pill cls="cool">요청</Pill></div>
            <div className="row">
              <button className="btn small primary" onClick={() => say(call("/api/admin/requests", { appid: r.appid, action: "approve" }))}>승인하고 추가</button>
              <button className="btn small" onClick={() => say(call("/api/admin/requests", { appid: r.appid, action: "hold" }))}>보류</button>
            </div>
          </div>
        ))}
        {missing.length > 0 && (
          <div className="todo-item"><div className="head"><div className="tx"><b>동접 과거 데이터 업로드가 필요한 게임 {missing.length}개</b><span>{missing.map((r: any) => r.g.name).join(", ")}</span></div><Pill cls="warn">확인 필요</Pill></div>
            <div className="fix"><b>이렇게 하세요</b> 아래 "동접 과거 데이터 업로드"의 순서를 따라 SteamDB 파일을 올려 주세요. 올리면 이 항목은 자동으로 사라집니다.</div>
            <div className="row"><a className="btn small primary" href="#csv">업로드 안내로 이동</a></div></div>
        )}
        {rows.filter((r: any) => !r.archived && r.g.review_cursor).length > 0 && (
          <div className="todo-item"><div className="head"><div className="tx"><b>과거 리뷰·플레이타임 보충 진행 중 ({rows.filter((r: any) => !r.archived && r.g.review_cursor).length}개 게임)</b>
            <span>자동으로 이어지는 작업입니다. 조치할 것은 없고, 아래 표의 "플레이타임 확보"가 올라가는지만 보시면 됩니다.</span></div><Pill cls="plain">자동 진행</Pill></div></div>
        )}
        {staleJobs.length === 0 && data.failed.filter((f: any) => f.attempts >= 3).length === 0 && data.requests.length === 0 && missing.length === 0 && (
          <p className="muted">지금 사람이 할 일은 없습니다.</p>
        )}
      </div>
      <details className="card guide">
        <summary>막힘·실패가 생기면 어떻게 하나요?</summary>
        <div className="tbl-wrap" style={{ marginTop: 10 }}><table>
          <thead><tr><th>원인</th><th>시스템이 먼저 하는 일</th><th>관리자가 할 일</th></tr></thead>
          <tbody>
            <tr><td>AI 응답 오류·형식 깨짐</td><td>3번 자동 재시도, 이전 결과는 그대로 유지</td><td>보통 없음. 계속 실패하면 [다시 시도] 또는 [건너뛰기]</td></tr>
            <tr><td>Gemini 키 만료·월 한도 도달</td><td>AI 분석만 멈추고 수집은 계속</td><td>키를 새로 넣거나 다음 달까지 기다리기</td></tr>
            <tr><td>Steam 응답 없음·일시 차단</td><td>쉬었다가 다음 실행 때 끊긴 곳부터 이어받기</td><td>없음. 3일 이상 계속되면 "자동 작업이 오래 멈춰 있습니다"가 뜹니다</td></tr>
            <tr><td>GitHub 접근 토큰 만료</td><td>버튼이 동작하지 않는다고 안내</td><td>토큰을 다시 발급해 환경변수에 입력 (1년에 한 번쯤)</td></tr>
            <tr><td>게임이 Steam에서 내려감</td><td>수집 중단 표시</td><td>게임 줄을 열어 [보관]</td></tr>
            <tr><td>데이터 이상 (예: 플레이타임이 전부 0)</td><td>표의 확보율이 오르지 않음</td><td>코드 점검이 필요합니다. 내용을 Claude에게 전달해 주세요</td></tr>
          </tbody></table></div>
      </details>

      <div className="sec-title"><h2>자동 작업 상태</h2><span>작업별 마지막 실행 기록</span></div>
      <div className="card" style={{ padding: 0 }}><div className="tbl-wrap"><table>
        <thead><tr><th>작업</th><th>마지막 시작</th><th>결과</th><th>메모</th></tr></thead>
        <tbody>
          {Object.keys(JOB_EVERY).map((j) => {
            const r = jobs.find((x) => x.job === j);
            const stale = !r || (now - new Date(r.started_at).getTime()) / 3600000 > JOB_EVERY[j];
            return (
              <tr key={j}><td><b>{JOB_LABEL[j]}</b></td><td>{r ? `${kst(r.started_at)} (${ago(r.started_at)})` : "기록 없음"}</td>
                <td>{!r ? <Pill cls="warn">없음</Pill> : r.ok === null && !r.finished_at ? <Pill cls="plain">실행 중이거나 중단됨</Pill> : r.ok ? <Pill cls={stale ? "warn" : "good"}>{stale ? "성공, 오래됨" : "성공"}</Pill> : <Pill cls="bad">실패</Pill>}</td>
                <td className="muted" style={{ fontSize: 12.5 }}>{r?.error ?? (r?.summary?.blocked ? "Steam이 일시적으로 응답하지 않아 쉬었습니다." : "")}</td></tr>
            );
          })}
        </tbody></table></div></div>

      <div className="sec-title"><h2>게임별 상태</h2><span>줄을 누르면 자세한 내용이 열립니다</span></div>
      <div className="legend2">
        <span><i className="dot good" />정상</span><span><i className="dot warn" />낡았거나 진행 중</span><span><i className="dot bad" />막힘·실패</span><span><i className="dot na" />해당 없음</span>
        <span className="muted">분석 칸 순서: {CHIPS.join(" · ")}</span>
      </div>
      <div className="card" style={{ padding: 0 }}><div className="tbl-wrap"><table className="gtable">
        <thead><tr><th>게임</th><th>수집 단계</th><th>마지막 수집 → 다음</th><th>리뷰 수집률</th><th>플레이타임 확보</th><th>분석 상태</th><th>동접 과거</th><th>상태</th></tr></thead>
        <tbody>
          {rows.map((r: any) => (
            <FragmentRow key={r.g.appid} r={r} open={open === r.g.appid} toggle={() => setOpen(open === r.g.appid ? null : r.g.appid)} say={say} onEvent={() => setEvOpen(r.g.appid)} />
          ))}
        </tbody></table></div></div>

      <div className="sec-title" id="csv"><h2>동접 과거 데이터 업로드</h2><span>수집 시작 이전 기록이 없는 게임용</span></div>
      <div className="card">
        <h3>필요한 게임: {missing.length ? missing.map((r: any) => r.g.name).join(", ") : "없음"}</h3>
        <ol className="steps">
          <li>해당 게임의 SteamDB 차트 페이지(steamdb.info/app/게임번호/graphs/)를 엽니다.</li>
          <li>차트 아래의 CSV 내려받기 버튼으로 파일을 저장합니다. 파일 안에 "DateTime"과 "Players" 열이 있어야 합니다.</li>
          <li>아래에서 게임을 고르고 파일을 선택하면 바로 올라갑니다.</li>
          <li>올리면 이 목록에서 해당 게임이 사라지고, 사용자 화면의 안내 문구도 사라집니다.</li>
        </ol>
        <div className="row" style={{ marginTop: 12 }}>
          <label>게임 <select value={csvGame} onChange={(e) => setCsvGame(e.target.value)}><option value="">선택…</option>{rows.filter((r: any) => !r.archived).map((r: any) => <option key={r.g.appid} value={r.g.appid}>{r.g.name}{r.ccuMissing ? " (필요)" : ""}</option>)}</select></label>
          <input ref={csvRef} type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCsv(f); }} />
        </div>
      </div>

      <div className="sec-title"><h2>고급</h2></div>
      <details className="card adv">
        <summary>평소에는 쓰지 않는 기능 (펼치기)</summary>
        <div className="list">
          <button className="btn" onClick={() => say(call("/api/admin/dispatch", { workflow: "collect-reviews.yml" }), false)}>수집 지금 실행</button>
          <Link className="btn" href="/admin/texts">화면 문구 관리 열기</Link>
        </div>
        <p className="help">수집 단계 고정, 보관·복원, AI 분석 켜기·끄기는 위 "게임별 상태"에서 게임 줄을 열어 바꿀 수 있습니다. 전체 재수집·재분석, 알림 설정, 내보내기는 컴퓨터에서 명령으로 실행합니다. (README 참고)</p>
      </details>

      {addOpen && <AddGameModal onClose={() => setAddOpen(false)} onDone={(m) => { setAddOpen(false); setToast(m); router.refresh(); }} />}
      {evOpen !== null && <EventModal games={rows.filter((r: any) => !r.archived).map((r: any) => r.g)} initial={evOpen === "pick" ? null : evOpen} onClose={() => setEvOpen(null)} onDone={(m) => { setEvOpen(null); setToast(m); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function FragmentRow({ r, open, toggle, say, onEvent }: { r: any; open: boolean; toggle: () => void; say: any; onEvent: () => void }) {
  const g = r.g;
  const dim = r.archived ? { opacity: 0.55 } : undefined;
  return (
    <>
      <tr className="row-btn" onClick={toggle} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") toggle(); }} style={dim}>
        <td><b>{g.name}</b></td>
        <td>{r.archived ? <Pill cls="plain nodot">보관</Pill> : <Pill cls="plain nodot">{TIER_LABEL[r.tier]}{g.tier_override ? " (고정)" : ""}</Pill>}</td>
        <td>{g.last_collected_at ? `${kst(g.last_collected_at)}` : "아직 없음"}{!r.archived && g.next_collect_at ? ` → ${kst(g.next_collect_at, false)}` : ""}</td>
        <td><span className="mini-bar"><i className={r.pct < 90 ? "warn" : ""} style={{ width: `${r.pct}%` }} /></span><span className="num">{r.pct}%</span></td>
        <td><span className="mini-bar"><i className={r.pt < 90 ? "warn" : ""} style={{ width: `${r.pt}%` }} /></span><span className="num">{r.pt}%</span></td>
        <td><div className="dots">{r.chips.map((d: Dot, i: number) => <i key={i} className={`dot ${d}`} title={CHIPS[i]} />)}</div></td>
        <td>{r.ccuMissing ? <Pill cls="warn">미업로드</Pill> : <Pill cls="good">있음</Pill>}</td>
        <td>{r.archived ? <Pill cls="plain">보관됨</Pill> : r.state === "good" ? <Pill cls="good">정상</Pill> : <Pill cls={r.state}>{r.note}</Pill>}</td>
      </tr>
      {open && (
        <tr className="detail"><td colSpan={8}><div className="cols">
          <div><h4>수집 현황</h4>DB {num(g.reviews_collected)}건 / Steam 전체 {num(g.steam_total_reviews)}건. 플레이타임 확보 {num(g.reviews_with_playtime)}건.
            {g.review_cursor ? " 과거 리뷰를 최신순으로 거슬러 보충하는 중이며, 중단되어도 저장된 위치에서 이어받습니다." : " 최신 구간은 동기화되어 있습니다."}</div>
          <div><h4>수집 단계 기준</h4>{TIER_LABEL[r.tier]} 단계는 {TIER_RULE[r.tier]} 수집합니다. 새 리뷰가 500건 쌓이면 앞당겨 수집합니다.
            <div className="row" style={{ marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
              <select value={g.tier_override ?? "auto"} onChange={(e) => say(call("/api/admin/games", { appid: g.appid, action: "tier", value: e.target.value }, "PATCH"))}>
                <option value="auto">자동</option>{Object.entries(TIER_LABEL).map(([k, l]) => <option key={k} value={k}>{l}으로 고정</option>)}
              </select></div></div>
          <div><h4>이 게임만</h4><div className="row" onClick={(e) => e.stopPropagation()}>
            <Link className="btn small" href={`/game/${g.appid}`}>화면 보기</Link>
            <button className="btn small" onClick={onEvent}>이벤트 등록</button>
            <button className="btn small" onClick={() => say(call("/api/admin/games", { appid: g.appid, action: "ai", value: !g.ai_enabled }, "PATCH"))}>{g.ai_enabled ? "AI 분석 끄기" : "AI 분석 켜기"}</button>
            {r.archived ? <button className="btn small" onClick={() => say(call("/api/admin/games", { appid: g.appid, action: "unarchive" }, "PATCH"))}>보관 해제</button>
              : <button className="btn small" onClick={() => say(call("/api/admin/games", { appid: g.appid, action: "archive" }, "PATCH"))}>보관</button>}
          </div></div>
        </div></td></tr>
      )}
    </>
  );
}

function AddGameModal({ onClose, onDone }: { onClose: () => void; onDone: (m: string) => void }) {
  const [sel, setSel] = useState<SteamHit | null>(null);
  const [months, setMonths] = useState(6);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    if (!sel) return;
    setBusy(true); setErr("");
    const r = await call("/api/admin/games", { appid: sel.appid, aiMonths: months });
    setBusy(false);
    if (r.ok) onDone(r.message); else setErr(r.message);
  }
  return (
    <Modal title="게임 추가" onClose={onClose}>
      {!sel ? <SteamSearch onPick={setSel} adminEndpoint /> : (
        <>
          <div className="res-item" style={{ cursor: "default" }}><Thumb appid={sel.appid} name={sel.name} src={sel.image} size="s" /><div><div className="t">{sel.name}</div><div className="m">{sel.meta} · AppID {sel.appid}</div></div></div>
          <div className="opt"><b>처음 분석할 기간</b>
            <label><input type="radio" name="months" checked={months === 6} onChange={() => setMonths(6)} /> 최근 6개월 (추천: 비용이 적고 빨리 끝납니다)</label>
            <label><input type="radio" name="months" checked={months === 12} onChange={() => setMonths(12)} /> 최근 12개월</label>
            <label><input type="radio" name="months" checked={months === 0} onChange={() => setMonths(0)} /> 출시부터 전부</label></div>
          <p className="muted" style={{ fontSize: 12.5 }}>추가하면 다음 수집 때 전체 리뷰를 받기 시작하고, 끝나면 첫 분석이 자동으로 시작됩니다. 수집에는 게임 규모에 따라 수십 분에서 몇 시간이 걸릴 수 있고, 중간에 끊겨도 이어받습니다.</p>
          {err && <p className="down" style={{ fontSize: 13 }}>{err}</p>}
          <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}><button className="btn" onClick={() => setSel(null)}>뒤로</button><button className="btn primary" disabled={busy} onClick={go}>{busy ? "추가 중…" : "추가하기"}</button></div>
        </>
      )}
    </Modal>
  );
}

function EventModal({ games, initial, onClose, onDone }: { games: any[]; initial: number | null; onClose: () => void; onDone: (m: string) => void }) {
  const [f, setF] = useState({ appid: initial ? String(initial) : "", date: new Date().toISOString().slice(0, 10), title: "", url: "", content: "" });
  const [err, setErr] = useState("");
  async function go() {
    const r = await call("/api/admin/events", { ...f, appid: Number(f.appid) });
    if (r.ok) onDone(r.message); else setErr(r.message);
  }
  return (
    <Modal title="이벤트 수동 등록" onClose={onClose}>
      <p className="muted" style={{ fontSize: 13 }}>Steam 공지에 없는 일(외부 방송, 대회, 논란 등)을 타임라인에 남깁니다.</p>
      <div className="opt">
        <label>게임 <select value={f.appid} onChange={(e) => setF({ ...f, appid: e.target.value })}><option value="">선택…</option>{games.map((g) => <option key={g.appid} value={g.appid}>{g.name}</option>)}</select></label>
        <label>날짜 <input type="text" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} placeholder="YYYY-MM-DD" /></label>
        <label>제목 <input type="text" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} style={{ flex: 1 }} /></label>
        <label>주소(선택) <input type="text" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} style={{ flex: 1 }} /></label>
        <label>내용(선택)</label><textarea rows={3} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} />
      </div>
      {err && <p className="down" style={{ fontSize: 13 }}>{err}</p>}
      <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn" onClick={onClose}>취소</button><button className="btn primary" onClick={go}>등록</button></div>
    </Modal>
  );
}
