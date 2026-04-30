"use client";
import { useState } from "react";

interface AnomalyMonth { ym: string; rate: number; reviewCount: number; }
interface AnomalyGame  { appid: string; name: string; affectedMonths: AnomalyMonth[]; }

interface Props {
  getSavedPw: () => string | null;
  onToast: (msg: string, type: "success" | "error") => void;
}

export default function AnomalySection({ getSavedPw, onToast }: Props) {
  const [scanning,  setScanning]  = useState(false);
  const [anomalies, setAnomalies] = useState<AnomalyGame[] | null>(null);

  // 게임별 구간재분석 로딩 상태: "appid_ym" → boolean
  const [reanalyzingMonth, setReanalyzingMonth] = useState<Set<string>>(new Set());
  // 게임별 종합분석 로딩 상태: appid → boolean
  const [reanalyzingCore,  setReanalyzingCore]  = useState<Set<string>>(new Set());
  // 게임별 일괄처리 로딩 상태
  const [batchProcessing,  setBatchProcessing]  = useState<Set<string>>(new Set());

  async function handleScan() {
    const pw = getSavedPw();
    if (!pw) return;
    setScanning(true);
    setAnomalies(null);
    try {
      const res  = await fetch("/api/admin/anomaly-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (data.ok) {
        setAnomalies(data.anomalies);
        if (data.anomalies.length === 0) onToast("이상 구간 없음 ✅", "success");
      } else {
        onToast(data.error ?? "스캔 실패", "error");
      }
    } catch {
      onToast("서버 연결 오류", "error");
    } finally {
      setScanning(false);
    }
  }

  /** 특정 월 구간 재분석 (analyze.yml) */
  async function handleReanalyzeMonth(appid: string, ym: string) {
    const pw  = getSavedPw();
    if (!pw) return;
    const key = `${appid}_${ym}`;
    setReanalyzingMonth((s) => new Set(s).add(key));
    try {
      const res  = await fetch("/api/admin/analyze-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, appid, year_month: ym }),
      });
      const data = await res.json();
      if (data.ok) onToast(`${ym} 구간 재분석 트리거 완료`, "success");
      else         onToast(data.error ?? "실패", "error");
    } catch {
      onToast("서버 연결 오류", "error");
    } finally {
      setReanalyzingMonth((s) => { const n = new Set(s); n.delete(key); return n; });
    }
  }

  /** 종합 분석 재실행 (core-analyze.yml) — AI 브리핑·추이 진단 포함 */
  async function handleReanalyzeCore(appid: string, name: string) {
    const pw = getSavedPw();
    if (!pw) return;
    setReanalyzingCore((s) => new Set(s).add(appid));
    try {
      const res  = await fetch("/api/admin/analyze-core", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, appid }),
      });
      const data = await res.json();
      if (data.ok) onToast(`${name} 종합 분석 재실행 트리거 완료`, "success");
      else         onToast(data.error ?? "실패", "error");
    } catch {
      onToast("서버 연결 오류", "error");
    } finally {
      setReanalyzingCore((s) => { const n = new Set(s); n.delete(appid); return n; });
    }
  }

  /** 일괄 처리: 이상 구간 전체 재분석 + 종합 분석 재실행 */
  async function handleBatchFix(game: AnomalyGame) {
    const pw = getSavedPw();
    if (!pw) return;
    setBatchProcessing((s) => new Set(s).add(game.appid));
    try {
      // 1. 이상 구간들 순차 재분석
      for (const m of game.affectedMonths) {
        await fetch("/api/admin/analyze-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pw, appid: game.appid, year_month: m.ym }),
        });
        await new Promise((r) => setTimeout(r, 800)); // 트리거 간격
      }
      // 2. 종합 분석 재실행
      await fetch("/api/admin/analyze-core", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, appid: game.appid }),
      });
      onToast(`${game.name} 일괄 처리 트리거 완료 (${game.affectedMonths.length}개 구간 + 종합 분석)`, "success");
    } catch {
      onToast("서버 연결 오류", "error");
    } finally {
      setBatchProcessing((s) => { const n = new Set(s); n.delete(game.appid); return n; });
    }
  }

  return (
    <section className="mb-10">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
          <span className="w-2 h-2 bg-accent-yellow rounded-full" />
          ⚠️ 이상 구간 감지
        </h2>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="px-3 py-1.5 text-xs border rounded-lg transition-colors disabled:opacity-40
            border-accent-yellow/40 text-accent-yellow hover:bg-accent-yellow/10"
        >
          {scanning ? "스캔 중…" : "긍정률 이상 스캔"}
        </button>
      </div>

      <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
        {/* 설명 */}
        <div className="px-4 py-3 border-b border-border-default">
          <p className="text-xs text-text-muted leading-relaxed">
            monthly_summary 구간 중 <span className="text-accent-yellow font-semibold">긍정률 99% 이상</span>인 이상 데이터를 찾습니다.
            해당 구간은 잘못된 AI 분석 결과를 포함할 수 있으므로 재분석이 필요합니다.
          </p>
        </div>

        {/* 결과 없음 */}
        {!anomalies && (
          <p className="px-4 py-6 text-xs text-text-muted text-center">
            {scanning ? "전체 게임 타임라인 스캔 중…" : "스캔 버튼을 눌러 이상 구간을 확인하세요."}
          </p>
        )}

        {/* 이상 없음 */}
        {anomalies && anomalies.length === 0 && (
          <p className="px-4 py-6 text-xs text-accent-green text-center font-medium">
            ✅ 이상 구간 없음
          </p>
        )}

        {/* 이상 목록 */}
        {anomalies && anomalies.length > 0 && (
          <div className="divide-y divide-border-default">
            {anomalies.map((game) => (
              <div key={game.appid} className="px-4 py-4">
                {/* 게임 헤더 */}
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-semibold text-text-primary">{game.name}</span>
                    <span className="ml-2 text-xs text-text-muted">appid: {game.appid}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReanalyzeCore(game.appid, game.name)}
                      disabled={reanalyzingCore.has(game.appid) || batchProcessing.has(game.appid)}
                      className="px-2.5 py-1 text-[11px] border rounded-lg transition-colors disabled:opacity-40
                        border-accent-blue/40 text-accent-blue hover:bg-accent-blue/10"
                    >
                      {reanalyzingCore.has(game.appid) ? "처리 중…" : "종합 분석 재실행"}
                    </button>
                    <button
                      onClick={() => handleBatchFix(game)}
                      disabled={batchProcessing.has(game.appid) || reanalyzingCore.has(game.appid)}
                      className="px-2.5 py-1 text-[11px] border rounded-lg transition-colors disabled:opacity-40
                        border-accent-yellow/40 text-accent-yellow hover:bg-accent-yellow/10 font-semibold"
                    >
                      {batchProcessing.has(game.appid) ? "처리 중…" : "⚡ 일괄 처리"}
                    </button>
                  </div>
                </div>

                {/* 이상 구간 목록 */}
                <div className="space-y-1 mt-2">
                  {game.affectedMonths.map((m) => {
                    const key = `${game.appid}_${m.ym}`;
                    return (
                      <div key={m.ym} className="flex items-center gap-3 bg-accent-yellow/5 border border-accent-yellow/20 rounded-lg px-3 py-2">
                        <span className="text-xs font-mono text-text-secondary w-16 flex-shrink-0">{m.ym}</span>
                        <span className="text-xs font-semibold text-accent-yellow w-12 flex-shrink-0">
                          {m.rate.toFixed(1)}%
                        </span>
                        <span className="text-xs text-text-muted flex-1">
                          {m.reviewCount.toLocaleString()}건
                        </span>
                        <button
                          onClick={() => handleReanalyzeMonth(game.appid, m.ym)}
                          disabled={reanalyzingMonth.has(key) || batchProcessing.has(game.appid)}
                          className="px-2.5 py-1 text-[11px] border rounded-lg transition-colors disabled:opacity-40
                            border-border-default text-text-secondary hover:border-accent-yellow/50 hover:text-accent-yellow"
                        >
                          {reanalyzingMonth.has(key) ? "처리 중…" : "구간 재분석"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
