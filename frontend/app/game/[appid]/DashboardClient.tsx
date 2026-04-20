"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/dashboard/Header";
import CcuChart from "@/components/dashboard/CcuChart";
import CcuAdminPanel from "@/components/dashboard/CcuAdminPanel";
import SentimentChart from "@/components/dashboard/SentimentChart";
import LanguageTab from "@/components/dashboard/LanguageTab";
import Timeline from "@/components/dashboard/Timeline";
import EventForm from "@/components/dashboard/EventForm";
import { useUiText } from "@/contexts/UiTextContext";
import type { Game, TimelineRow, CcuRow } from "@/types";

type Tab = "ccu" | "sentiment" | "language";

interface Props {
  game: Game;
  timelineRows: TimelineRow[];
  ccuRows: CcuRow[];
  currentCcu?: number;
  topSentimentRate?: number;
  topLanguages: string[];
}

export default function DashboardClient({
  game, timelineRows, ccuRows,
  currentCcu, topSentimentRate, topLanguages,
}: Props) {
  const router = useRouter();
  const { t } = useUiText();
  const [activeTab, setActiveTab] = useState<Tab>("ccu");

  // 언어 분포 파싱 (RAW 리뷰 기반 JSON — 파이 차트용)
  const languageDistribution: Record<string, number> = (() => {
    try {
      return game.language_distribution ? JSON.parse(game.language_distribution) : {};
    } catch {
      return {};
    }
  })();

  const TABS: { key: Tab; labelKey: string }[] = [
    { key: "ccu",       labelKey: "TAB_CCU" },
    { key: "sentiment", labelKey: "TAB_SENTIMENT" },
    { key: "language",  labelKey: "TAB_LANGUAGE" },
  ];

  return (
    <div>
      <Header game={game} currentCcu={currentCcu} topSentimentRate={topSentimentRate} />

      <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-8">

        {/* ── 차트 탭 ─────────────────────────────────────────────── */}
        <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
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
                {t(tab.labelKey)}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === "ccu" && (
              <>
                <CcuChart
                  data={ccuRows}
                  peaktimeComment={game.ccu_peaktime_comment}
                />
                <CcuAdminPanel
                  currentAppId={String(game.appid)}
                  gameName={game.name_kr || game.name}
                  onCsvUploaded={() => router.refresh()}
                />
              </>
            )}
            {activeTab === "sentiment" && (
              <SentimentChart
                timelineRows={timelineRows}
                topLanguages={topLanguages}
                sentimentTrendComment={game.sentiment_trend_comment}
              />
            )}
            {activeTab === "language" && (
              <LanguageTab
                timelineRows={timelineRows}
                crossAnalysisComment={game.language_cross_comment}
                languageDistribution={languageDistribution}
              />
            )}
          </div>
        </div>

        {/* ── 업데이트 히스토리 ────────────────────────────────────── */}
        <div className="bg-bg-card border border-border-default rounded-xl p-6">
          <h2 className="text-base font-semibold text-text-primary mb-6">{t("HISTORY_TITLE")}</h2>
          <Timeline timelineRows={timelineRows} appid={String(game.appid)} releaseDate={game.release_date} />
        </div>

        {/* ── 수동 이벤트 등록 (관리자) ────────────────────────────── */}
        <div className="bg-bg-card border border-border-default rounded-xl p-6">
          <EventForm
            appid={String(game.appid)}
            onEventAdded={() => router.refresh()}
          />
        </div>

      </div>

    </div>
  );
}
