"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/dashboard/Header";
import CcuChart from "@/components/dashboard/CcuChart";
import SentimentChart from "@/components/dashboard/SentimentChart";
import LanguageTab from "@/components/dashboard/LanguageTab";
import Timeline from "@/components/dashboard/Timeline";
import Sidebar from "@/components/dashboard/Sidebar";
import ChatBot from "@/components/chatbot/ChatBot";
import type { Game, TimelineRow, CcuRow } from "@/types";

type Tab = "ccu" | "sentiment" | "language";

interface Props {
  game: Game;
  timelineRows: TimelineRow[];
  ccuRows: CcuRow[];
  allGames: Game[];
  currentCcu?: number;
  topSentimentRate?: number;
  topLanguages: string[];
}

export default function DashboardClient({
  game, timelineRows, ccuRows, allGames,
  currentCcu, topSentimentRate, topLanguages,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("ccu");
  const [compareAppId, setCompareAppId] = useState<string | null>(null);
  const [compareCcuData, setCompareCcuData] = useState<CcuRow[]>([]);
  const [compareGame, setCompareGame] = useState<Game | null>(null);

  // CCU 피크타임 AI 코멘트 (timeline에서 가장 최신 all 행)
  const peaktimeComment = timelineRows
    .filter((r) => r.language_scope === "all")
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.ai_reaction_summary ?? "";

  // 언어권 교차 분석 코멘트
  const crossComment = timelineRows
    .filter((r) => r.language_scope === "all" && r.ai_reaction_summary)
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.ai_reaction_summary ?? "";

  async function handleCompareSelect(appid: string) {
    const game = allGames.find((g) => String(g.appid) === appid);
    setCompareGame(game ?? null);
    setCompareAppId(appid);

    const res = await fetch(`/api/game/${appid}/ccu`);
    const data: CcuRow[] = await res.json();
    setCompareCcuData(data);
    setActiveTab("ccu");
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "ccu", label: "글로벌 트래픽 (CCU)" },
    { key: "sentiment", label: "평가 추이" },
    { key: "language", label: "언어권별 분포" },
  ];

  return (
    <div>
      <Header game={game} currentCcu={currentCcu} topSentimentRate={topSentimentRate} />

      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* 메인 컨텐츠 */}
          <div className="flex-1 min-w-0 space-y-8">
            {/* 차트 탭 */}
            <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
              {/* 탭 헤더 */}
              <div className="flex border-b border-border-default">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-5 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? "text-accent-blue border-b-2 border-accent-blue"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {activeTab === "ccu" && (
                  <CcuChart
                    data={ccuRows}
                    topLanguages={topLanguages}
                    peaktimeComment={peaktimeComment}
                    currentPeakCcu={Number(game.peak_ccu)}
                    compareGame={
                      compareGame && compareCcuData.length > 0
                        ? { name: compareGame.name_kr || compareGame.name, data: compareCcuData, peakCcu: Number(compareGame.peak_ccu) }
                        : undefined
                    }
                  />
                )}
                {activeTab === "sentiment" && (
                  <SentimentChart timelineRows={timelineRows} topLanguages={topLanguages} />
                )}
                {activeTab === "language" && (
                  <LanguageTab timelineRows={timelineRows} crossAnalysisComment={crossComment} />
                )}
              </div>
            </div>

            {/* 타임라인 */}
            <div className="bg-bg-card border border-border-default rounded-xl p-6">
              <h2 className="text-base font-semibold text-text-primary mb-6">업데이트 히스토리</h2>
              <Timeline timelineRows={timelineRows} />
            </div>
          </div>

          {/* 사이드바 */}
          <div className="w-72 shrink-0">
            <Sidebar
              currentAppId={String(game.appid)}
              games={allGames}
              onCompareSelect={handleCompareSelect}
              onEventAdded={() => router.refresh()}
              onDeleted={() => router.push("/")}
            />
          </div>
        </div>
      </div>

      {/* 챗봇 FAB */}
      <ChatBot game={game} timelineRows={timelineRows} />
    </div>
  );
}
