"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GROUPS, TEXT_DEFS, type Texts } from "@/lib/text-defs";
import { WF_BASE, WF_HEIGHT } from "@/lib/wireframe";

export default function TextsClient({ texts, saved }: { texts: Texts; saved: string[] }) {
  const router = useRouter();
  const [vals, setVals] = useState<Texts>(texts);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set(saved));
  const [sel, setSel] = useState("");
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [toast, setToast] = useState("");
  const wfRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 3500); return () => clearTimeout(id); }, [toast]);

  const numbered = TEXT_DEFS.map((t, i) => ({ ...t, n: i + 1 }));
  const cur = numbered.find((t) => t.key === sel);
  const spots = numbered.filter((t) => t.spot[0] === screen);

  async function act(key: string, body: Record<string, unknown>) {
    const r = await fetch("/api/admin/texts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, ...body }) });
    const j = await r.json().catch(() => ({}));
    setToast(j.message ?? j.error ?? "실패했습니다.");
    if (r.ok) {
      const def = TEXT_DEFS.find((t) => t.key === key)!;
      if (body.reset) { setVals({ ...vals, [key]: def.def }); const s = new Set(savedKeys); s.delete(key); setSavedKeys(s); }
      else setSavedKeys(new Set(savedKeys).add(key));
      router.refresh();
    }
  }
  function select(key: string, fromMap: boolean) {
    const t = numbered.find((x) => x.key === key)!;
    setSel(key); setScreen(t.spot[0]);
    if (fromMap) document.getElementById(`ti-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    else if (window.innerWidth < 1000) wfRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="txt-grid">
      <div className="txt-list">
        {GROUPS.map((gr) => {
          const items = numbered.filter((t) => t.group === gr.id);
          return (
            <details key={gr.id} className="card txt-group" open>
              <summary>{gr.title} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>{items.length}개</span></summary>
              <div className="in">
                {items.map((t) => (
                  <div key={t.key} id={`ti-${t.key}`} className={`txt-item${sel === t.key ? " hot" : ""}`}>
                    <div><span className="nn">{t.n}</span><b>{t.label}</b><span className="key">{t.key}</span>{savedKeys.has(t.key) && <span className="pill good nodot" style={{ marginLeft: 8 }}>수정됨</span>}</div>
                    <div className="where">{t.where}</div>
                    {t.multi
                      ? <textarea id={`tx-${t.key}`} rows={2} value={vals[t.key]} onChange={(e) => setVals({ ...vals, [t.key]: e.target.value })} />
                      : <input id={`tx-${t.key}`} type="text" value={vals[t.key]} onChange={(e) => setVals({ ...vals, [t.key]: e.target.value })} style={{ width: "100%" }} />}
                    <div className="row">
                      <button className="btn primary small" onClick={() => act(t.key, { value: vals[t.key] })}>저장</button>
                      <button className="btn small" onClick={() => act(t.key, { reset: true })}>기본값 복원</button>
                      <button className="btn small ghost" onClick={() => select(t.key, false)}>위치 보기</button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>
      <div className="wfbox card" ref={wfRef}>
        <h3>위치 지도</h3>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={screen === "home"} onClick={() => setScreen("home")}>홈 화면</button>
          <button role="tab" aria-selected={screen === "game"} onClick={() => setScreen("game")}>게임 상세 화면</button>
        </div>
        <svg className="wf" viewBox={`0 0 360 ${WF_HEIGHT[screen]}`} role="img" aria-label="화면 구조 지도">
          <g dangerouslySetInnerHTML={{ __html: WF_BASE[screen] }} />
          {spots.map((t) => (
            <rect key={t.key} className={`${sel === t.key ? "sel" : "hot"}${t.spot[5] === "dash" ? " dash" : ""}`} x={t.spot[1]} y={t.spot[2]} width={t.spot[3]} height={t.spot[4]} onClick={() => select(t.key, true)}><title>{t.label}</title></rect>
          ))}
          {spots.map((t) => (
            <g key={`m${t.key}`} style={{ pointerEvents: "none" }}><circle className="mk" cx={t.spot[1] + 1} cy={t.spot[2] + 1} r="5" /><text className="mt" x={t.spot[1] + 1} y={t.spot[2] + 3.4}>{t.n}</text></g>
          ))}
        </svg>
        <p className="wfcap">{cur ? <><b>{cur.n}. {cur.label}</b><br />{cur.where}{cur.tabHint && <> <span className="pill plain nodot">{cur.tabHint} 안</span></>}</> : "항목의 \"위치 보기\"를 누르거나 지도의 번호 칸을 눌러 보세요."}</p>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
